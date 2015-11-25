var ad = require('adnn/ad');
var nn = require('adnn/nn');
var NNArch = require('./nnarch.js');
var Tensor = require('adnn/tensor');


// Predict ERP params as a function of the local pixel window of the target image
//    around the current position. Do this at multiple scales.
// Learnable, linear version

var Arch = new NNArch();

var nPyramidLevels = 4;

Arch.nnFunction('downsample', function(name) {
	return nn.convolution({filterSize: 2, stride: 2}, name);
});

Arch.init = function(globalStore) {
	// Construct target pyramid
	globalStore.pyramid = [globalStore.target.tensor];
	for (var i = 0; i < nPyramidLevels-1; i++) {
		var prev = globalStore.pyramid[i];
		var next = this.downsample('downsample_level'+i).eval(prev);
		globalStore.pyramid.push(next);
	}
	this.nTotalFeatures = 9*nPyramidLevels + this.nLocalFeatures;
};

Arch.nnFunction('paramPredictMLP', function(name, nOut) {
	return nn.mlp(this.nTotalFeatures, [
		{nOut: Math.floor(this.nTotalFeatures/2), activation: nn.tanh},
		{nOut: Math.floor(this.nTotalFeatures/4), activation: nn.tanh},
		// {nOut: Math.floor(this.nTotalFeatures/8), activation: nn.tanh},
		{nOut: nOut}
	], name);
});

Arch.nnFunction('outOfBounds', function(name) {
	return nn.constantparams([nPyramidLevels], 'outOfBounds');
});

function normalize(x, lo, hi) {
	return (x - lo) / (hi - lo);
}

Arch.predict = function(globalStore, localState, name, paramBounds) {
	// Extract pixel neighborhood at each pyramid level, concat into
	//    one vector (along with local features)
	var outOfBoundsVals = ad.tensorToScalars(this.outOfBounds().eval());
	var features = new Array(this.nTotalFeatures);
	var v = this.constants.viewport;
	var x = normalize(localState.pos.x, v.xmin, v.xmax);
	var y = normalize(localState.pos.y, v.ymin, v.ymax);
	var fidx = 0;
	for (var i = 0; i < nPyramidLevels; i++) {
		var outOfBounds = outOfBoundsVals[i];
		var img = globalStore.pyramid[i];
		var imgsize = ad.value(img).dims[1];	// dim 0 is channel depth (= 1)
		var cx = Math.floor(x*imgsize);
		var cy = Math.floor(y*imgsize);
		for (var wy = cy - 1; wy <= cy + 1; wy++) {
			for (var wx = cx - 1; wx <= cx + 1; wx++) {
				var imgidx = wy*imgsize + wx;
				var inbounds = wx >= 0 && wx < imgsize && wy >= 0 && wy < imgsize;
				features[fidx] = inbounds ? ad.tensorEntry(img, imgidx) : outOfBounds;
				fidx++;
			}
		}
	}
	for (var i = 0; i < this.nLocalFeatures; i++, fidx++) {
		features[fidx] = localState.features.data[i];
	}
	features = ad.scalarsToTensor(features);

	// Feed features into MLP
	var nOut = paramBounds.length;
	var y = this.paramPredictMLP(name, nOut).eval(features);
	return this.splitAndBoundParams(y, paramBounds);
};


module.exports = Arch;


