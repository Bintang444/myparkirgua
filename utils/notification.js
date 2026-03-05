// NOTIFICATION HELPER

// Show toast notification
export function showNotification(message, type = 'success') {
    const notif = document.createElement('div')
    notif.className = 'notification'
    notif.textContent = message
    
    // Set color based on type
    let bgColor = '#10b981' // success (green)
    if (type === 'error') bgColor = '#ef4444' // red
    if (type === 'warning') bgColor = '#f59e0b' // orange
    if (type === 'info') bgColor = '#3b82f6' // blue
    
    notif.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${bgColor};
        color: white; 
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 9999;
        animation: slideIn 0.3s ease;
        max-width: 400px;
        font-size: 14px;
        font-weight: 500;
    `
    
    document.body.appendChild(notif)
    
    setTimeout(() => {
        notif.style.animation = 'slideOut 0.3s ease'
        setTimeout(() => notif.remove(), 300)
    }, 3000)
}

// Show success notification
export function showSuccess(message) {
    showNotification(message, 'success')
}

// Show error notification
export function showError(message) {
    showNotification(message, 'error')
}

// Show warning notification
export function showWarning(message) {
    showNotification(message, 'warning')
}

// Show info notification
export function showInfo(message) {
    showNotification(message, 'info')
}