"use strict";

(function () {
	const inputMes = document.getElementById('inputMes');
	const fltAgente = document.getElementById('fltAgente');

	function buildUrl(mes, agente) {
		let url = '/reportes/reporte-pagos-diarios';
		const params = [];
		if (mes) params.push('mes=' + mes);
		if (agente) params.push('agente=' + agente);
		if (params.length) url += '?' + params.join('&');
		return url;
	}

	if (inputMes) {
		inputMes.addEventListener('change', function () {
			window.location.href = buildUrl(this.value, fltAgente ? fltAgente.value : '');
		});
	}

	if (fltAgente) {
		fltAgente.addEventListener('change', function () {
			window.location.href = buildUrl(inputMes ? inputMes.value : '', this.value);
		});
	}
})();
