(function () {
	const form = document.getElementById('loanForm');

	const cui = document.getElementById('cui');
	const nombre = document.getElementById('nombre');
	const cantidad = document.getElementById('cantidad');

	const cuiError = document.getElementById('cuiError');
	const nombreError = document.getElementById('nombreError');

	const amountPill = document.getElementById('amountPill');
	const btnSubmit = document.getElementById('btnSubmit');
	const btnReset = document.getElementById('btnReset');
	const pillStatus = document.getElementById('pillStatus');

	const sumCui = document.getElementById('sumCui');
	const sumNombre = document.getElementById('sumNombre');
	const sumPrincipal = document.getElementById('sumPrincipal');
	const sumCuota = document.getElementById('sumCuota');
	const sumTotal = document.getElementById('sumTotal');

	const uiCuota = document.getElementById('cuotaDiaria');
	const uiTotal = document.getElementById('totalPagar');

	const PLAZO_DIAS = 35;      // constante
	const K_PAR = 20;           // U35
	const K_IMPAR = 15;         // V35

	// Q enteros (sin centavos)
	const moneyInt = (n) => {
		const value = Math.round(Number(n || 0));
		return new Intl.NumberFormat('es-GT', { maximumFractionDigits: 0 }).format(value);
	};

	const moneyQ = (n) => `Q ${moneyInt(n)}`;

	function onlyDigits13(value) {
		const digits = String(value || '').replace(/\D/g, '');
		return digits.slice(0, 13);
	}

	function calcular(principal) {
		const N = principal / 500;                // factor 500
		const par = Math.ceil(N / 2);             // REDONDEAR(N/2;0) para enteros -> equivale a CEIL
		const impar = N - par;                    // N - par

		const cuota = Math.ceil((K_PAR * par) + (K_IMPAR * impar)); // redondeo hacia arriba a entero
		const total = cuota * PLAZO_DIAS;

		return { N, par, impar, cuota, total };
	}

	function validateAndRender() {
		let ok = true;

		// Normalizar CUI
		const cuiVal = onlyDigits13(cui.value);
		if (cui.value !== cuiVal) cui.value = cuiVal;

		if (!cuiVal) {
			cuiError.textContent = 'El CUI es obligatorio.';
			ok = false;
		} else if (cuiVal.length !== 13) {
			cuiError.textContent = 'El CUI debe tener exactamente 13 dígitos.';
			ok = false;
		} else {
			cuiError.textContent = '';
		}

		// Nombre
		const nameVal = (nombre.value || '').trim();
		if (!nameVal) {
			nombreError.textContent = 'El nombre completo es obligatorio.';
			ok = false;
		} else if (nameVal.length < 3) {
			nombreError.textContent = 'Ingrese un nombre válido.';
			ok = false;
		} else {
			nombreError.textContent = '';
		}

		// Principal (slider)
		const principal = Number(cantidad.value || 500);
		amountPill.textContent = moneyQ(principal);

		// Cálculos
		const calc = calcular(principal);
		uiCuota.textContent = moneyQ(calc.cuota);
		uiTotal.textContent = moneyQ(calc.total);

		// Resumen
		sumCui.textContent = cuiVal ? cuiVal : '—';
		sumNombre.textContent = nameVal ? nameVal : '—';
		sumPrincipal.textContent = moneyQ(principal);
		sumCuota.textContent = moneyQ(calc.cuota);
		sumTotal.textContent = moneyQ(calc.total);

		btnSubmit.disabled = !ok;
		pillStatus.style.display = ok ? 'inline-flex' : 'none';

		return { ok, principal, calc, cuiVal, nameVal };
	}

	// Eventos
	cui.addEventListener('input', validateAndRender);
	nombre.addEventListener('input', validateAndRender);
	cantidad.addEventListener('input', validateAndRender);

	btnReset.addEventListener('click', () => {
		form.reset();
		cantidad.value = 500;
		pillStatus.style.display = 'none';
		validateAndRender();
	});

	form.addEventListener('submit', (e) => {
		e.preventDefault();

		const state = validateAndRender();
		if (!state.ok) return;

		const payload = {
			cui: state.cuiVal,
			nombre: state.nameVal,
			principal: state.principal,
			cuota_diaria: state.calc.cuota,
			total_pagar: state.calc.total,
			plazo_dias: PLAZO_DIAS
		};

		// Envío a backend (ajuste la ruta)
		// fetch('/api/prestamos', {
		//   method: 'POST',
		//   headers: { 'Content-Type': 'application/json' },
		//   body: JSON.stringify(payload)
		// })
		// .then(r => r.ok ? r.json() : Promise.reject(r))
		// .then(data => { ... })
		// .catch(err => { ... });

		console.log('Préstamo a guardar:', payload);

		// UX simple
		btnSubmit.textContent = 'Guardado ✔';
		btnSubmit.disabled = true;
		setTimeout(() => {
			btnSubmit.textContent = 'Guardar préstamo';
			validateAndRender();
		}, 1200);
	});

	// init
	validateAndRender();
})();