
function uniformScore(params, val) {
  if (val < params[0] || val > params[1]) {
    return -Infinity;
  }
  return -Math.log(params[1] - params[0]);
}

function flipScore(params, val) {
  if (val != true && val != false) {
    return -Infinity;
  }
  var weight = params[0];
  return val ? Math.log(weight) : Math.log(1 - weight);
}

function randomIntegerScore(params, val) {
  var stop = params[0];
  var inSupport = (val == Math.floor(val)) && (0 <= val) && (val < stop);
  return inSupport ? -Math.log(stop) : -Infinity;
}

var LOG_2PI = 1.8378770664093453;
function gaussianScore(params, x) {
  var mu = params[0];
  var sigma = params[1];
  return -0.5 * (LOG_2PI + 2 * Math.log(sigma) + (x - mu) * (x - mu) / (sigma * sigma));
}

function sum(xs) {
  if (xs.length === 0) {
    return 0.0;
  } else {
    var total = 0;
    var n = xs.length;
    for (var i = 0; i < n; i++) total = total + xs[i];
    return total;
  }
}

function normalizeArray(xs) {
  var Z = sum(xs);
  return xs.map(function(x) {
    return x / Z;
  });
}

function discreteScore(params, val) {
  var probs = normalizeArray(params);
  var stop = probs.length;
  var inSupport = (val == Math.floor(val)) && (0 <= val) && (val < stop);
  return inSupport ? Math.log(probs[val]) : -Infinity;
}

var gammaCof = [
  76.18009172947146,
  -86.50532032941677,
  24.01409824083091,
  -1.231739572450155,
  0.1208650973866179e-2,
  -0.5395239384953e-5];

function logGamma(xx) {
  var x = xx - 1.0;
  var tmp = x + 5.5;
  tmp = tmp - ((x + 0.5) * Math.log(tmp));
  var ser = 1.000000000190015;
  for (var j = 0; j <= 5; j++) {
    x = x + 1;
    ser = ser + (gammaCof[j] / x);
  }
  return -tmp + Math.log(2.5066282746310005 * ser);
}

function gammaScore(params, val) {
  var a = params[0];
  var b = params[1];
  var x = val;
  return (a - 1) * Math.log(x) - x / b - logGamma(a) - a * Math.log(b);
}

function exponentialScore(params, val) {
  var a = params[0];
  return Math.log(a) - a * val;
}

function logBeta(a, b) {
  return logGamma(a) + logGamma(b) - logGamma(a + b);
}

function betaScore(params, val) {
  var a = params[0];
  var b = params[1];
  var x = val;
  return ((x > 0 && x < 1) ?
      (a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - logBeta(a, b) :
      -Infinity);
}

var digammaCof = [
  -1 / 12, 1 / 120, -1 / 252, 1 / 240,
  -5 / 660, 691 / 32760, -1 / 12];

function digamma(x) {
  if (x < 0) {
    return digamma(1 - x) - Math.PI / Math.tan(Math.PI * x);
  } else if (x < 6) {
    var n = Math.ceil(6 - x);
    var psi = digamma(x + n);
    for (var i = 0; i < n; i++) {
      psi = psi - 1 / (x + i);
    }
    return psi;
  } else {
    var psi = Math.log(x) - 1 / (2 * x);
    var invsq = 1 / (x * x);
    var z = 1;
    for (var i = 0; i < digammaCof.length; i++) {
      z = z * invsq;
      psi = psi + digammaCof[i] * z;
    }
    return psi;
  }
}

function fact(x) {
  var t = 1;
  while (x > 1) {
    t = t * x;
    x = x - 1;
  }
  return t;
}

function lnfact(x) {
  if (x < 1) {
    x = 1;
  }
  if (x < 12) {
    return Math.log(fact(Math.round(x)));
  }
  var invx = 1 / x;
  var invx2 = invx * invx;
  var invx3 = invx2 * invx;
  var invx5 = invx3 * invx2;
  var invx7 = invx5 * invx2;
  var sum = ((x + 0.5) * Math.log(x)) - x;
  sum += Math.log(2 * Math.PI) / 2;
  sum += (invx / 12) - (invx3 / 360);
  sum += (invx5 / 1260) - (invx7 / 1680);
  return sum;
}

function binomialG(x) {
  if (x === 0) {
    return 1;
  }
  if (x === 1) {
    return 0;
  }
  var d = 1 - x;
  return (1 - (x * x) + (2 * x * Math.log(x))) / (d * d);
}

function binomialScore(params, val) {
  var p = params[0];
  var n = params[1];
  if (n > 20 && n * p > 5 && n * (1 - p) > 5) {
    // large n, reasonable p approximation
    var s = val;
    var inv2 = 1 / 2;
    var inv3 = 1 / 3;
    var inv6 = 1 / 6;
    if (s >= n) {
      return -Infinity;
    }
    var q = 1 - p;
    var S = s + inv2;
    var T = n - s - inv2;
    var d1 = s + inv6 - (n + inv3) * p;
    var d2 = q / (s + inv2) - p / (T + inv2) + (q - inv2) / (n + 1);
    d2 = d1 + 0.02 * d2;
    var num = 1 + q * binomialG(S / (n * p)) + p * binomialG(T / (n * q));
    var den = (n + inv6) * p * q;
    var z = num / den;
    var invsd = Math.sqrt(z);
    z = d2 * invsd;
    return gaussianScore([0, 1], z) + Math.log(invsd);
  } else {
    // exact formula
    return (lnfact(n) - lnfact(n - val) - lnfact(val) +
        val * Math.log(p) + (n - val) * Math.log(1 - p));
  }
}

function poissonScore(params, val) {
  var mu = params[0];
  var k = val;
  return k * Math.log(mu) - mu - lnfact(k);
}

function dirichletScore(params, val) {
  var alpha = params;
  var theta = val;
  var asum = 0;
  for (var i = 0; i < alpha.length; i++) {
    asum = asum + alpha[i];
  }
  var logp = logGamma(asum);
  for (var j = 0; j < alpha.length; j++) {
    logp = logp + ((alpha[j] - 1) * Math.log(theta[j]));
    logp = logp - logGamma(alpha[j]);
  }
  return logp;
}

function logsumexp(a) {
  var m = -Infinity;
  for (var i = 0; i < a.length; i++) {
    m = Math.max(m, a[i]);
  }
  var sum = 0;
  for (var i = 0; i < a.length; ++i) {
    sum = sum + (a[i] === -Infinity ? 0 : Math.exp(a[i] - m));
  }
  return m + Math.log(sum);
}

function mixtureScore(scorer, params, weights, val) {
  var wsum = 0;
  for (var i = 0; i < weights.length; i++) {
    wsum = wsum + weights[i];
  }
  var weightedScores = [];
  for (var i = 0; i < weights.length; i++) {
    var ls = Math.log(weights[i]/wsum) + scorer(params[i], val);
    weightedScores.push(ls);
  }
  return logsumexp(weightedScores);
}


module.exports = {
	uniform: uniformScore,
	flip: flipScore,
	randomInteger: randomIntegerScore,
	gaussian: gaussianScore,
	discrete: discreteScore,
	gamma: gammaScore,
	exponential: exponentialScore,
	beta: betaScore,
	binomial: binomialScore,
	poisson: poissonScore,
	dirichlet: dirichletScore,
  mixture: mixtureScore
}


