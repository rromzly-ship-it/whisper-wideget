/**
 * Voice Profile & Speaker Verification Module (0 Dependency, Pure Math)
 * Menangani pendaftaran sidik suara pemilik (Voiceprint Enrollment), ekstraksi fitur akustik
 * (Pitch F0, Formant/Mel-Filterbank, MFCC 12-dim, Spectral Centroid), dan verifikasi kemiripan vokal.
 */
const fs = require('fs');
const path = require('path');

const PROFILE_FILE = path.join(__dirname, 'voice-profile.json');

// Mel filterbank configuration (24 bands, 80 Hz - 7500 Hz)
const NUM_MEL_BINS = 24;
const NUM_MFCC = 12;

function hzToMel(hz) {
  return 2595 * Math.log10(1 + hz / 700);
}

function melToHz(mel) {
  return 700 * (Math.pow(10, mel / 2595) - 1);
}

function createMelFilterbank(sampleRate, fftSize) {
  const numFilters = NUM_MEL_BINS;
  const minMel = hzToMel(80);
  const maxMel = hzToMel(Math.min(7500, sampleRate / 2));
  const melPoints = [];
  for (let i = 0; i < numFilters + 2; i++) {
    melPoints.push(minMel + (i * (maxMel - minMel)) / (numFilters + 1));
  }
  const hzPoints = melPoints.map(melToHz);
  const binPoints = hzPoints.map(hz => Math.floor(((fftSize + 1) * hz) / sampleRate));

  const filters = [];
  for (let m = 1; m <= numFilters; m++) {
    const filter = new Float32Array(Math.floor(fftSize / 2) + 1);
    const left = binPoints[m - 1];
    const center = binPoints[m];
    const right = binPoints[m + 1];

    for (let k = left; k < center; k++) {
      if (center > left) filter[k] = (k - left) / (center - left);
    }
    for (let k = center; k < right; k++) {
      if (right > center) filter[k] = (right - k) / (right - center);
    }
    filters.push(filter);
  }
  return filters;
}

// Simple Discrete Cosine Transform (DCT-II)
function dct(input, numCoeffs) {
  const N = input.length;
  const out = new Float32Array(numCoeffs);
  for (let k = 0; k < numCoeffs; k++) {
    let sum = 0;
    for (let n = 0; n < N; n++) {
      sum += input[n] * Math.cos((Math.PI * k * (2 * n + 1)) / (2 * N));
    }
    out[k] = sum * (k === 0 ? Math.sqrt(1 / N) : Math.sqrt(2 / N));
  }
  return out;
}

// Power Spectrum calculation from windowed audio slice
function computePowerSpectrum(frame, fftSize) {
  const N = frame.length;
  const half = Math.floor(fftSize / 2) + 1;
  const power = new Float32Array(half);

  // Apply Hann Window
  const windowed = new Float32Array(fftSize);
  for (let i = 0; i < N && i < fftSize; i++) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
    windowed[i] = frame[i] * w;
  }

  // DFT for magnitude spectrum (sufficient for frameSize 512)
  for (let k = 0; k < half; k++) {
    let real = 0;
    let imag = 0;
    const omega = (2 * Math.PI * k) / fftSize;
    // Step by 2 for speed
    for (let n = 0; n < fftSize; n += 2) {
      const angle = omega * n;
      real += windowed[n] * Math.cos(angle);
      imag -= windowed[n] * Math.sin(angle);
    }
    power[k] = (real * real + imag * imag) / fftSize;
  }
  return power;
}

// Autocorrelation-based pitch (F0) estimation
function estimatePitch(frame, sampleRate) {
  const minPeriod = Math.floor(sampleRate / 350); // ~350 Hz max
  const maxPeriod = Math.floor(sampleRate / 75);  // ~75 Hz min
  let bestR = 0;
  let bestLag = -1;

  let energy = 0;
  for (let i = 0; i < frame.length; i++) energy += frame[i] * frame[i];
  if (energy < 1e-4) return 0;

  for (let lag = minPeriod; lag <= maxPeriod && lag < frame.length; lag++) {
    let r = 0;
    for (let n = 0; n < frame.length - lag; n++) {
      r += frame[n] * frame[n + lag];
    }
    r = r / energy;
    if (r > bestR && r > 0.35) {
      bestR = r;
      bestLag = lag;
    }
  }
  return bestLag > 0 ? sampleRate / bestLag : 0;
}

// Extract acoustic feature vector from PCM samples (Float32Array)
function extractVoiceFeatures(pcmSamples, sampleRate = 16000) {
  const frameSize = 512;
  const hopSize = 256;
  const filters = createMelFilterbank(sampleRate, frameSize);

  const pitches = [];
  const centroids = [];
  const allMfccs = [];
  const allMelEnergies = [];

  const half = Math.floor(frameSize / 2) + 1;
  const freqs = new Float32Array(half);
  for (let i = 0; i < half; i++) {
    freqs[i] = (i * sampleRate) / frameSize;
  }

  for (let offset = 0; offset + frameSize <= pcmSamples.length; offset += hopSize) {
    const frame = pcmSamples.subarray(offset, offset + frameSize);

    // Compute RMS to filter out silence
    let sumSq = 0;
    for (let i = 0; i < frameSize; i++) sumSq += frame[i] * frame[i];
    const rms = Math.sqrt(sumSq / frameSize);
    if (rms < 0.02) continue; // Skip silence

    // 1. Pitch
    const pitch = estimatePitch(frame, sampleRate);
    if (pitch >= 75 && pitch <= 350) {
      pitches.push(pitch);
    }

    // 2. Power Spectrum & Spectral Centroid
    const power = computePowerSpectrum(frame, frameSize);
    let weightedSum = 0;
    let totalPower = 0;
    for (let k = 0; k < half; k++) {
      weightedSum += freqs[k] * power[k];
      totalPower += power[k];
    }
    const centroid = totalPower > 1e-6 ? weightedSum / totalPower : 0;
    if (centroid > 0) centroids.push(centroid);

    // 3. Mel Filterbank Energies
    const melEnergies = new Float32Array(NUM_MEL_BINS);
    for (let m = 0; m < NUM_MEL_BINS; m++) {
      const filt = filters[m];
      let energy = 0;
      for (let k = 0; k < half; k++) {
        energy += power[k] * filt[k];
      }
      melEnergies[m] = Math.log(Math.max(1e-5, energy));
    }
    allMelEnergies.push(melEnergies);

    // 4. MFCC
    const mfcc = dct(melEnergies, NUM_MFCC);
    allMfccs.push(mfcc);
  }

  if (allMfccs.length === 0) {
    return null; // Audio too short or only silence
  }

  // Mean & Std computation
  const meanMfcc = new Float32Array(NUM_MFCC);
  for (const m of allMfccs) {
    for (let i = 0; i < NUM_MFCC; i++) meanMfcc[i] += m[i];
  }
  for (let i = 0; i < NUM_MFCC; i++) meanMfcc[i] /= allMfccs.length;

  const meanMel = new Float32Array(NUM_MEL_BINS);
  for (const mel of allMelEnergies) {
    for (let i = 0; i < NUM_MEL_BINS; i++) meanMel[i] += mel[i];
  }
  for (let i = 0; i < NUM_MEL_BINS; i++) meanMel[i] /= allMelEnergies.length;

  const meanPitch = pitches.length > 0 ? pitches.reduce((a, b) => a + b, 0) / pitches.length : 0;
  const meanCentroid = centroids.length > 0 ? centroids.reduce((a, b) => a + b, 0) / centroids.length : 0;

  return {
    meanPitch: Math.round(meanPitch),
    meanCentroid: Math.round(meanCentroid),
    mfcc: Array.from(meanMfcc).map(v => Number(v.toFixed(4))),
    mel: Array.from(meanMel).map(v => Number(v.toFixed(4))),
    framesCount: allMfccs.length
  };
}

// Cosine similarity between two float arrays
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Compare target features against stored voice profile
function compareVoiceFeatures(candidate, profile) {
  if (!candidate || !profile || !profile.mfcc) {
    return { match: false, score: 0, reason: 'Profil belum terdaftar atau audio kosong' };
  }

  // 1. MFCC Cosine Similarity (primary timbre measure)
  const mfccSim = cosineSimilarity(candidate.mfcc, profile.mfcc);

  // 2. Mel Filterbank Energy Envelope Similarity
  const melSim = cosineSimilarity(candidate.mel, profile.mel);

  // 3. Spectral Centroid delta penalty
  const centroidRatio = profile.meanCentroid > 0 && candidate.meanCentroid > 0
    ? Math.min(candidate.meanCentroid, profile.meanCentroid) / Math.max(candidate.meanCentroid, profile.meanCentroid)
    : 1;

  // 4. Pitch delta check (if pitch detected in both)
  let pitchFactor = 1;
  if (candidate.meanPitch > 0 && profile.meanPitch > 0) {
    const pitchDiff = Math.abs(candidate.meanPitch - profile.meanPitch);
    if (pitchDiff > 55) {
      pitchFactor = Math.max(0.65, 1 - (pitchDiff - 55) / 110);
    }
  }

  // Blended acoustic score (scaled to 0-100%)
  const combined = (mfccSim * 0.55 + melSim * 0.35 + centroidRatio * 0.10) * pitchFactor;
  const scorePct = Math.max(0, Math.min(100, Math.round(combined * 100)));

  return {
    score: scorePct,
    mfccSim: Number((mfccSim * 100).toFixed(1)),
    melSim: Number((melSim * 100).toFixed(1)),
    pitchMatch: pitchFactor >= 0.95
  };
}

// Load profile from disk
function loadVoiceProfile() {
  try {
    if (fs.existsSync(PROFILE_FILE)) {
      const data = JSON.parse(fs.readFileSync(PROFILE_FILE, 'utf8'));
      if (data && data.mfcc && Array.isArray(data.mfcc)) {
        return data;
      }
    }
  } catch (e) {
    console.error('Gagal membaca voice-profile.json:', e);
  }
  return null;
}

// Save profile to disk
function saveVoiceProfile(profileData) {
  try {
    fs.writeFileSync(PROFILE_FILE, JSON.stringify(profileData, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Gagal menyimpan voice-profile.json:', e);
    return false;
  }
}

// Delete profile
function deleteVoiceProfile() {
  try {
    if (fs.existsSync(PROFILE_FILE)) {
      fs.unlinkSync(PROFILE_FILE);
    }
    return true;
  } catch (e) {
    console.error('Gagal menghapus voice-profile.json:', e);
    return false;
  }
}

module.exports = {
  extractVoiceFeatures,
  compareVoiceFeatures,
  loadVoiceProfile,
  saveVoiceProfile,
  deleteVoiceProfile
};
