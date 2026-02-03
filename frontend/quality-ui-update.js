/**
 * UPDATED updateAIQualityUI function to handle face detection status codes
 *
 * Replace the existing updateAIQualityUI function in test-camera.html with this version
 * Look for line ~773 in test-camera.html
 */

function updateAIQualityUI(result) {
    // Update score circle
    const scoreValue = document.getElementById('scoreValue');
    const scoreCircle = document.getElementById('scoreCircle');
    const scoreLevel = document.getElementById('scoreLevel');
    const scoreStatus = document.getElementById('scoreStatus');

    // Handle edge cases (no face, multiple faces, etc.)
    if (result.status !== 'OK') {
        // Show warning state
        scoreValue.textContent = '--';
        scoreCircle.style.background = '#2a2a2a';
        scoreLevel.textContent = result.status.replace('_', ' ');
        scoreLevel.className = 'score-level poor';

        // Status-specific messages
        let statusMessage, statusColor, detailMessage;
        switch(result.status) {
            case 'NO_FACE':
                statusMessage = '⚠ No face detected';
                statusColor = '#ff9500';
                detailMessage = 'Center your face in the frame';
                break;
            case 'MULTIPLE_FACES':
                statusMessage = '⚠ Multiple faces detected';
                statusColor = '#ff9500';
                detailMessage = 'Ensure you are alone in the frame';
                break;
            case 'FACE_TOO_SMALL':
                statusMessage = '⚠ Face too small';
                statusColor = '#ff9500';
                detailMessage = 'Move closer to the camera';
                break;
            case 'PARTIAL_FACE':
                statusMessage = '⚠ Face partially out of frame';
                statusColor = '#ff9500';
                detailMessage = 'Center your face fully in frame';
                break;
            default:
                statusMessage = '✗ Quality check failed';
                statusColor = '#ff3b30';
                detailMessage = result.message || 'Unknown error';
        }

        document.getElementById('aiStatus').textContent = statusMessage;
        document.getElementById('aiStatus').style.color = statusColor;
        scoreStatus.textContent = detailMessage;

        // Update other info
        document.getElementById('aiLastCheck').textContent = new Date().toLocaleTimeString();
        document.getElementById('aiInferenceTime').textContent = `${result.inference_time_ms}ms`;
        return;
    }

    // Normal case: face detected and quality assessed
    // Display score
    scoreValue.textContent = result.quality_score.toFixed(2);

    // Update circle color based on quality
    let color;
    if (result.quality_level === 'good') {
        color = '#34c759';
    } else if (result.quality_level === 'acceptable') {
        color = '#ff9500';
    } else {
        color = '#ff3b30';
    }

    // Update circle gradient (0-360 degrees based on score)
    const degrees = result.quality_score * 360;
    scoreCircle.style.background = `conic-gradient(${color} ${degrees}deg, #2a2a2a ${degrees}deg)`;

    // Update level text
    scoreLevel.textContent = result.quality_level.toUpperCase();
    scoreLevel.className = `score-level ${result.quality_level}`;

    // Update status
    if (result.threshold_met) {
        document.getElementById('aiStatus').textContent = '✓ Good quality';
        document.getElementById('aiStatus').style.color = '#34c759';
        scoreStatus.textContent = 'Ready for recording';
    } else {
        document.getElementById('aiStatus').textContent = '✗ Improve lighting/position';
        document.getElementById('aiStatus').style.color = '#ff9500';
        scoreStatus.textContent = 'Adjust camera for better quality';
    }

    // Update other info
    document.getElementById('aiLastCheck').textContent = new Date().toLocaleTimeString();
    document.getElementById('aiInferenceTime').textContent = `${result.inference_time_ms}ms`;
}