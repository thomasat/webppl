var fs = require('fs');
var webppl = require('../src/main.js');

function loadTraces(filename) {
	var lines = fs.readFileSync(filename).toString().split('\n');
	
	//Remove first line, which is the name of the training dataset
	lines.shift();

	if (lines[lines.length-1] === '') {
		lines.splice(lines.length-1, 1);
	}
	return lines.map(function(line) {
		return JSON.parse(line);
	});
}

// Call a webppl function from js code by setting up our own trampoline
function runwebppl(fn, args, store, address, continuation) {
	continuation = continuation || function() {};
	address = address || '';
	store = store || {};
	args = args || [];
	var allargs = [store, continuation, address].concat(args);
	var trampoline = fn.apply(null, allargs);
	while(trampoline) {
		trampoline = trampoline();
	}
}

// Compile and run a webppl file, making a variable called __ROOT
//    available which refers to some root directory (to make
//    it easier to call require)
// Returns whatever the webbpl script returns
function execWebpplFileWithRoot(filename, rootdir) {
	var code = "var __ROOT = '" + rootdir + "';\n" + fs.readFileSync(filename);
	var retval;
	webppl.run(code, function(s, rets) {
		retval = rets;
	});
	return retval;
}

// Wrapper for the 'new' operator that can be called in webppl code
function _new(ctor) {
	var args = Array.prototype.slice.call(arguments, 1);
	var obj = Object.create(ctor.prototype);
	ctor.apply(obj, args);
	return obj;
}

module.exports = {
	loadTraces: loadTraces,
	runwebppl: runwebppl,
	execWebpplFileWithRoot: execWebpplFileWithRoot,
	new: _new
};