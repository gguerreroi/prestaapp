"use strict";

(function () {
	const inputMes = document.getElementById('inputMes');

	if (inputMes) {
		inputMes.addEventListener('change', function () {
			window.location.href = '/reportes/resumen-general?mes=' + this.value;
		});
	}
})();
