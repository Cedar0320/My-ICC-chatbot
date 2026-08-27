// Chart.js CDN loader for quick chart rendering
// This file will dynamically load Chart.js if not present
(function() {
    if (!window.Chart) {
        var script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        script.onload = function() {
            console.log('Chart.js loaded');
        };
        document.head.appendChild(script);
    }
})();
