/**
 * ARCHIVED: Real-Time Quality Metrics
 *
 * These functions were removed from test-camera.html due to performance burden on mobile devices.
 * The AI quality score (via Triton backend) is now the primary quality indicator.
 *
 * Archived: 2026-02-02
 * Reason: CPU-intensive operations causing frame drops on mobile
 *
 * Functions included:
 * - analyzeBlur() - Laplacian variance for sharpness
 * - estimateNoise() - Pixel-to-pixel variance
 * - detectOverexposure() - Face region overexposure detection
 * - measureBrightness() - Average luminance
 * - measureContrast() - Standard deviation of luminance
 * - analyzeColorBalance() - RGB channel balance
 * - measureStability() - Temporal variance tracking
 */

// =============================================================================
// State Variables
// =============================================================================

let qualityAnalysisInterval = null;
let qualityHistory = {
    blur: [],
    noise: [],
    brightness: [],
    maxHistory: 5  // Keep last 5 measurements
};

// =============================================================================
// Analysis Functions
// =============================================================================

/**
 * Analyze blur using Laplacian variance method
 * Higher variance = sharper edges = less blur
 * @param {ImageData} imageData - Canvas ImageData object
 * @returns {number} Blur score (higher = sharper)
 */
function analyzeBlur(imageData) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;

    // Convert to grayscale and apply Laplacian kernel
    const laplacian = [];

    // Laplacian kernel (3x3 second derivative)
    // [ 0  1  0 ]
    // [ 1 -4  1 ]
    // [ 0  1  0 ]

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = (y * width + x) * 4;

            // Convert current pixel to grayscale
            const center = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];

            // Get neighbors
            const top = 0.299 * data[((y-1) * width + x) * 4] + 0.587 * data[((y-1) * width + x) * 4 + 1] + 0.114 * data[((y-1) * width + x) * 4 + 2];
            const bottom = 0.299 * data[((y+1) * width + x) * 4] + 0.587 * data[((y+1) * width + x) * 4 + 1] + 0.114 * data[((y+1) * width + x) * 4 + 2];
            const left = 0.299 * data[(y * width + (x-1)) * 4] + 0.587 * data[(y * width + (x-1)) * 4 + 1] + 0.114 * data[(y * width + (x-1)) * 4 + 2];
            const right = 0.299 * data[(y * width + (x+1)) * 4] + 0.587 * data[(y * width + (x+1)) * 4 + 1] + 0.114 * data[(y * width + (x+1)) * 4 + 2];

            // Apply Laplacian: -4*center + top + bottom + left + right
            const lap = -4 * center + top + bottom + left + right;
            laplacian.push(lap);
        }
    }

    // Calculate variance of Laplacian
    const mean = laplacian.reduce((sum, val) => sum + val, 0) / laplacian.length;
    const variance = laplacian.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / laplacian.length;

    return variance;
}

/**
 * Estimate noise level by measuring local variance in the image
 * Uses standard deviation of pixel differences
 * Lower values = cleaner image
 * @param {ImageData} imageData - Canvas ImageData object
 * @returns {number} Estimated noise level (0-100 scale)
 */
function estimateNoise(imageData) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;

    // Calculate horizontal and vertical differences
    const differences = [];

    // Sample every 3rd pixel for performance
    for (let y = 1; y < height - 1; y += 3) {
        for (let x = 1; x < width - 1; x += 3) {
            const idx = (y * width + x) * 4;

            // Current pixel luminance
            const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];

            // Right neighbor
            const rightIdx = (y * width + (x + 1)) * 4;
            const lumRight = 0.299 * data[rightIdx] + 0.587 * data[rightIdx + 1] + 0.114 * data[rightIdx + 2];

            // Bottom neighbor
            const bottomIdx = ((y + 1) * width + x) * 4;
            const lumBottom = 0.299 * data[bottomIdx] + 0.587 * data[bottomIdx + 1] + 0.114 * data[bottomIdx + 2];

            // Store absolute differences
            const diffH = Math.abs(lum - lumRight);
            const diffV = Math.abs(lum - lumBottom);

            // Only use small differences (likely noise, not edges)
            if (diffH < 50) differences.push(diffH);
            if (diffV < 50) differences.push(diffV);
        }
    }

    if (differences.length === 0) return 0;

    // Calculate standard deviation of differences
    const mean = differences.reduce((sum, val) => sum + val, 0) / differences.length;
    const variance = differences.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / differences.length;
    const stdDev = Math.sqrt(variance);

    // Scale to 0-100 range for display (empirically tuned)
    return stdDev * 2.5;
}

/**
 * Detect overexposure focusing on face region (center of frame)
 * For facial data collection, overexposure on the face is critical,
 * but overexposure in background (windows, lights) is acceptable
 * @param {ImageData} imageData - Canvas ImageData object
 * @returns {number} Percentage of overexposed pixels in face region (0-100)
 */
function detectOverexposure(imageData) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;

    // Define face region: center 70% of frame (typical selfie framing)
    const faceLeft = Math.floor(width * 0.15);
    const faceRight = Math.floor(width * 0.85);
    const faceTop = Math.floor(height * 0.2);
    const faceBottom = Math.floor(height * 0.8);

    let overexposedCount = 0;
    let brightCount = 0;
    let totalFacePixels = 0;

    // Check each pixel in face region
    for (let y = faceTop; y < faceBottom; y++) {
        for (let x = faceLeft; x < faceRight; x++) {
            const idx = (y * width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];

            totalFacePixels++;

            // Calculate luminance
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;

            // Count bright pixels (potential face area)
            if (lum > 80) {
                brightCount++;

                // Check if bright pixel is overexposed
                // Lowered thresholds to catch more subtle overexposure
                if (r > 240 || g > 240 || b > 240) {
                    // At least one channel blown out
                    overexposedCount++;
                } else if (r > 230 && g > 230 && b > 230) {
                    // All channels very bright (near clipping)
                    overexposedCount++;
                }
            }
        }
    }

    // If we have bright pixels, calculate overexposure percentage
    // relative to bright areas (where face likely is)
    if (brightCount > totalFacePixels * 0.1) {
        return (overexposedCount / brightCount) * 100;
    } else {
        // Very dark scene - no overexposure possible
        return 0;
    }
}

/**
 * Measure average brightness using perceived luminance
 * @param {ImageData} imageData - Canvas ImageData object
 * @returns {number} Average brightness (0-255)
 */
function measureBrightness(imageData) {
    const data = imageData.data;
    let totalLuminance = 0;
    const totalPixels = data.length / 4;

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Calculate perceived luminance (Rec. 709 luma coefficients)
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        totalLuminance += luminance;
    }

    return totalLuminance / totalPixels;
}

/**
 * Measure contrast by calculating luminance standard deviation
 * Low contrast = flat lighting, hard to see facial features
 * @param {ImageData} imageData - Canvas ImageData object
 * @returns {number} Contrast score (0-100 scale)
 */
function measureContrast(imageData) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;

    // Focus on face region for contrast measurement
    const faceLeft = Math.floor(width * 0.15);
    const faceRight = Math.floor(width * 0.85);
    const faceTop = Math.floor(height * 0.2);
    const faceBottom = Math.floor(height * 0.8);

    const luminances = [];

    // Sample face region
    for (let y = faceTop; y < faceBottom; y += 2) {
        for (let x = faceLeft; x < faceRight; x += 2) {
            const idx = (y * width + x) * 4;
            const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
            luminances.push(lum);
        }
    }

    // Calculate standard deviation (measure of contrast)
    const mean = luminances.reduce((sum, val) => sum + val, 0) / luminances.length;
    const variance = luminances.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / luminances.length;
    const stdDev = Math.sqrt(variance);

    // Scale to 0-100 range (typical std dev is 0-60, scale up)
    return Math.min(100, stdDev * 1.8);
}

/**
 * Detect color cast by analyzing RGB channel balance
 * Severe color casts affect facial recognition accuracy
 * @param {ImageData} imageData - Canvas ImageData object
 * @returns {object} {score: 0-100, castType: string}
 */
function analyzeColorBalance(imageData) {
    const data = imageData.data;
    let totalR = 0, totalG = 0, totalB = 0;
    const totalPixels = data.length / 4;

    // Calculate average RGB values
    for (let i = 0; i < data.length; i += 4) {
        totalR += data[i];
        totalG += data[i + 1];
        totalB += data[i + 2];
    }

    const avgR = totalR / totalPixels;
    const avgG = totalG / totalPixels;
    const avgB = totalB / totalPixels;

    // Calculate deviations from gray (balanced color)
    const avg = (avgR + avgG + avgB) / 3;
    const rDev = Math.abs(avgR - avg);
    const gDev = Math.abs(avgG - avg);
    const bDev = Math.abs(avgB - avg);
    const maxDev = Math.max(rDev, gDev, bDev);

    // Determine cast type and severity
    let castType = 'Neutral';
    if (maxDev > 10) {
        if (avgB > avgR && avgB > avgG) castType = 'Blue Cast';
        else if (avgR > avgG && avgR > avgB) castType = 'Warm Cast';
        else if (avgG > avgR && avgG > avgB) castType = 'Green Cast';
    }

    // Score: lower deviation = better (0 is perfect, higher is worse)
    // Invert for display: 100 = perfect, 0 = severe cast
    const score = Math.max(0, 100 - maxDev * 3);

    return { score, castType };
}

/**
 * Track temporal stability of quality metrics
 * Fluctuating metrics indicate unstable conditions
 */
function measureStability() {
    if (qualityHistory.blur.length < 2) {
        return { score: 100, label: 'Measuring...' };
    }

    // Calculate coefficient of variation for each metric
    const calcCV = (arr) => {
        const mean = arr.reduce((sum, val) => sum + val, 0) / arr.length;
        if (mean === 0) return 0;
        const variance = arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
        const stdDev = Math.sqrt(variance);
        return (stdDev / mean) * 100;  // Coefficient of variation as percentage
    };

    const blurCV = calcCV(qualityHistory.blur);
    const noiseCV = calcCV(qualityHistory.noise);
    const brightnessCV = calcCV(qualityHistory.brightness);

    // Average CV - lower is more stable
    const avgCV = (blurCV + noiseCV + brightnessCV) / 3;

    // Convert to stability score (lower CV = higher stability)
    // CV < 10% = excellent, CV > 30% = poor
    const stabilityScore = Math.max(0, 100 - avgCV * 3);

    let label = 'Stable';
    if (stabilityScore < 50) label = 'Unstable';
    else if (stabilityScore < 75) label = 'Moderate';

    return { score: stabilityScore, label };
}

// =============================================================================
// UI Update Functions
// =============================================================================

/**
 * Get status indicator and label based on metric value
 */
function getStatusInfo(metric, value) {
    let status, indicator, label, color;

    switch(metric) {
        case 'blur':
            if (value > 100) {
                status = 'good';
                indicator = '✅';
                label = 'Sharp';
                color = '#34c759';
            } else if (value > 50) {
                status = 'warning';
                indicator = '⚠️';
                label = 'Acceptable';
                color = '#ff9500';
            } else {
                status = 'bad';
                indicator = '❌';
                label = 'Blurry';
                color = '#ff3b30';
            }
            break;

        case 'noise':
            if (value < 30) {
                status = 'good';
                indicator = '✅';
                label = 'Low';
                color = '#34c759';
            } else if (value < 60) {
                status = 'warning';
                indicator = '⚠️';
                label = 'Moderate';
                color = '#ff9500';
            } else {
                status = 'bad';
                indicator = '❌';
                label = 'High';
                color = '#ff3b30';
            }
            break;

        case 'overexposure':
            if (value < 5) {
                status = 'good';
                indicator = '✅';
                label = 'Good';
                color = '#34c759';
            } else if (value < 15) {
                status = 'warning';
                indicator = '⚠️';
                label = 'Warning';
                color = '#ff9500';
            } else {
                status = 'bad';
                indicator = '❌';
                label = 'Burnt';
                color = '#ff3b30';
            }
            break;

        case 'brightness':
            if (value >= 80 && value <= 180) {
                status = 'good';
                indicator = '✅';
                label = 'Optimal';
                color = '#34c759';
            } else if ((value >= 50 && value < 80) || (value > 180 && value <= 220)) {
                status = 'warning';
                indicator = '⚠️';
                label = 'Acceptable';
                color = '#ff9500';
            } else {
                status = 'bad';
                indicator = '❌';
                label = value < 50 ? 'Too Dark' : 'Too Bright';
                color = '#ff3b30';
            }
            break;

        case 'contrast':
            if (value > 40) {
                status = 'good';
                indicator = '✅';
                label = 'Good';
                color = '#34c759';
            } else if (value > 25) {
                status = 'warning';
                indicator = '⚠️';
                label = 'Low';
                color = '#ff9500';
            } else {
                status = 'bad';
                indicator = '❌';
                label = 'Flat';
                color = '#ff3b30';
            }
            break;

        case 'colorBalance':
            if (value > 80) {
                status = 'good';
                indicator = '✅';
                label = 'Neutral';
                color = '#34c759';
            } else if (value > 60) {
                status = 'warning';
                indicator = '⚠️';
                label = 'Slight Cast';
                color = '#ff9500';
            } else {
                status = 'bad';
                indicator = '❌';
                label = 'Color Cast';
                color = '#ff3b30';
            }
            break;

        case 'stability':
            if (value > 75) {
                status = 'good';
                indicator = '✅';
                label = 'Stable';
                color = '#34c759';
            } else if (value > 50) {
                status = 'warning';
                indicator = '⚠️';
                label = 'Moderate';
                color = '#ff9500';
            } else {
                status = 'bad';
                indicator = '❌';
                label = 'Unstable';
                color = '#ff3b30';
            }
            break;
    }

    return { status, indicator, label, color };
}

/**
 * Update quality metrics display
 */
function updateQualityMetrics(blur, noise, overexp, bright, contrast, colorBalance, stability) {
    // Blur
    const blurInfo = getStatusInfo('blur', blur);
    document.getElementById('blurScore').innerHTML =
        `<span style="color: ${blurInfo.color}">${blur.toFixed(1)} ${blurInfo.indicator} ${blurInfo.label}</span>`;

    // Noise
    const noiseInfo = getStatusInfo('noise', noise);
    document.getElementById('noiseLevel').innerHTML =
        `<span style="color: ${noiseInfo.color}">${noise.toFixed(1)} ${noiseInfo.indicator} ${noiseInfo.label}</span>`;

    // Overexposure
    const overexpInfo = getStatusInfo('overexposure', overexp);
    document.getElementById('overexposure').innerHTML =
        `<span style="color: ${overexpInfo.color}">${overexp.toFixed(1)}% ${overexpInfo.indicator} ${overexpInfo.label}</span>`;

    // Brightness
    const brightInfo = getStatusInfo('brightness', bright);
    document.getElementById('brightness').innerHTML =
        `<span style="color: ${brightInfo.color}">${bright.toFixed(0)} ${brightInfo.indicator} ${brightInfo.label}</span>`;

    // Contrast
    const contrastInfo = getStatusInfo('contrast', contrast);
    document.getElementById('contrast').innerHTML =
        `<span style="color: ${contrastInfo.color}">${contrast.toFixed(1)} ${contrastInfo.indicator} ${contrastInfo.label}</span>`;

    // Color Balance
    const colorBalanceInfo = getStatusInfo('colorBalance', colorBalance.score);
    document.getElementById('colorBalance').innerHTML =
        `<span style="color: ${colorBalanceInfo.color}">${colorBalance.score.toFixed(0)} ${colorBalanceInfo.indicator} ${colorBalance.castType}</span>`;

    // Stability
    const stabilityInfo = getStatusInfo('stability', stability.score);
    document.getElementById('stability').innerHTML =
        `<span style="color: ${stabilityInfo.color}">${stability.score.toFixed(0)} ${stabilityInfo.indicator} ${stability.label}</span>`;
}

/**
 * Start real-time quality analysis
 */
function startQualityAnalysis() {
    const video = document.getElementById('preview');
    const canvas = document.getElementById('analysisCanvas');
    const ctx = canvas.getContext('2d');

    // Set canvas size (downsample for performance)
    canvas.width = 640;
    canvas.height = 480;

    // Show quality panel
    document.getElementById('qualityPanel').style.display = 'block';

    // Clear any existing interval
    if (qualityAnalysisInterval) {
        clearInterval(qualityAnalysisInterval);
    }

    // Run analysis every 2 seconds
    qualityAnalysisInterval = setInterval(() => {
        try {
            // Capture current video frame
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            // Run all quality analyses
            const blurScore = analyzeBlur(imageData);
            const noiseLevel = estimateNoise(imageData);
            const overexposure = detectOverexposure(imageData);
            const brightness = measureBrightness(imageData);
            const contrast = measureContrast(imageData);
            const colorBalance = analyzeColorBalance(imageData);

            // Update history for stability tracking
            qualityHistory.blur.push(blurScore);
            qualityHistory.noise.push(noiseLevel);
            qualityHistory.brightness.push(brightness);

            // Keep only last N measurements
            if (qualityHistory.blur.length > qualityHistory.maxHistory) {
                qualityHistory.blur.shift();
                qualityHistory.noise.shift();
                qualityHistory.brightness.shift();
            }

            // Measure stability
            const stability = measureStability();

            // Update UI
            updateQualityMetrics(blurScore, noiseLevel, overexposure, brightness, contrast, colorBalance, stability);

            console.log('📊 Quality Analysis:', {
                blur: blurScore.toFixed(1) + ' ' + (blurScore > 100 ? '✅' : blurScore > 50 ? '⚠️' : '❌'),
                noise: noiseLevel.toFixed(1) + ' ' + (noiseLevel < 30 ? '✅' : noiseLevel < 60 ? '⚠️' : '❌'),
                overexposure: overexposure.toFixed(1) + '% (face) ' + (overexposure < 5 ? '✅' : overexposure < 15 ? '⚠️' : '❌'),
                brightness: brightness.toFixed(0) + ' ' + (brightness >= 80 && brightness <= 180 ? '✅' : '⚠️'),
                contrast: contrast.toFixed(1) + ' ' + (contrast > 40 ? '✅' : contrast > 25 ? '⚠️' : '❌'),
                colorBalance: colorBalance.score.toFixed(0) + ' (' + colorBalance.castType + ') ' + (colorBalance.score > 80 ? '✅' : colorBalance.score > 60 ? '⚠️' : '❌'),
                stability: stability.score.toFixed(0) + ' (' + stability.label + ') ' + (stability.score > 75 ? '✅' : stability.score > 50 ? '⚠️' : '❌')
            });
        } catch (err) {
            console.error('Quality analysis error:', err);
        }
    }, 2000);
}
