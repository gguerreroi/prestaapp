"use strict";

(function () {
	const inputMes = document.getElementById('inputMes');
	const fltAgente = document.getElementById('fltAgente');

	function buildUrl(mes, agente) {
		let url = '/reportes/cobranza-mensual';
		const params = [];
		if (mes) params.push('mes=' + mes);
		if (agente) params.push('agente=' + agente);
		if (params.length) url += '?' + params.join('&');
		return url;
	}

	if (inputMes) {
		inputMes.addEventListener('change', function () {
			const agente = fltAgente ? fltAgente.value : '';
			window.location.href = buildUrl(this.value, agente);
		});
	}

	if (fltAgente) {
		fltAgente.addEventListener('change', function () {
			const mes = inputMes ? inputMes.value : '';
			window.location.href = buildUrl(mes, this.value);
		});
	}
})();
