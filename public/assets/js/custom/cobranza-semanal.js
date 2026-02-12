"use strict";

document.addEventListener("DOMContentLoaded", function () {

	// Navegacion por fecha: al cambiar el input date, redirigir
	const inputSemana = document.getElementById("inputSemana");
	if (inputSemana) {
		inputSemana.addEventListener("change", function () {
			const fecha = this.value;
			if (fecha) {
				const params = new URLSearchParams(window.location.search);
				params.set("semana", fecha);
				window.location.href = "/reportes/cobranza-semanal?" + params.toString();
			}
		});
	}

	// Filtro por agente
	const fltAgente = document.getElementById("fltAgente");
	if (fltAgente) {
		fltAgente.addEventListener("change", function () {
			const params = new URLSearchParams(window.location.search);
			if (this.value) {
				params.set("agente", this.value);
			} else {
				params.delete("agente");
			}
			window.location.href = "/reportes/cobranza-semanal?" + params.toString();
		});
	}

});
