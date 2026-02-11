"use strict";

(function () {
	const form = document.getElementById("loanForm");
	if (!form) return;

	// ======= Inputs base =======
	const cui = document.getElementById("cui");
	const cantidad = document.getElementById("cantidad");
	const fechaPrestamo = document.getElementById("fechaPrestamo"); // name="fecha_inicio"

	// ======= UI / errores =======
	const cuiError = document.getElementById("cuiError");
	const fechaPrestamoError = document.getElementById("fechaPrestamoError");

	const amountPill = document.getElementById("amountPill");
	const btnSubmit = document.getElementById("btnSubmit");
	const btnReset = document.getElementById("btnReset");
	const pillStatus = document.getElementById("pillStatus");

	const btnBuscarCui = document.getElementById("btnBuscarCui");

	const cuiStatusWrap = document.getElementById("cuiStatusWrap");
	const cuiStatusBadge = document.getElementById("cuiStatusBadge");
	const cuiStatusText = document.getElementById("cuiStatusText");

	// ======= Secciones cliente =======
	const nuevoClienteWrap = document.getElementById("nuevoClienteWrap");
	const clienteExistenteCard = document.getElementById("clienteExistenteCard");
	const clienteExistenteNombre = document.getElementById("clienteExistenteNombre");
	const clienteExistenteDetalle = document.getElementById("clienteExistenteDetalle");

	// Campos nuevo cliente
	const nombres = document.getElementById("nombres");
	const apellidos = document.getElementById("apellidos");
	const direccion = document.getElementById("direccion");
	const telefono = document.getElementById("telefono");
	const cartera = document.getElementById("cartera");
	const observaciones = document.getElementById("observaciones");

	const nombresError = document.getElementById("nombresError");
	const apellidosError = document.getElementById("apellidosError");
	const direccionError = document.getElementById("direccionError");
	const telefonoError = document.getElementById("telefonoError");
	const carteraError = document.getElementById("carteraError");

	// Archivos (opcionales)
	const cuiFrontal = document.getElementById("cuiFrontal");
	const cuiDorsal = document.getElementById("cuiDorsal");
	const fotoVivienda = document.getElementById("fotoVivienda");
	const fotoPersona = document.getElementById("fotoPersona");

	// ======= Summary / cálculo =======
	const sumCui = document.getElementById("sumCui");
	const sumNombre = document.getElementById("sumNombre");
	const sumPrincipal = document.getElementById("sumPrincipal");
	const sumCuota = document.getElementById("sumCuota");
	const sumTotal = document.getElementById("sumTotal");

	const uiCuota = document.getElementById("cuotaDiaria");
	const uiTotal = document.getElementById("totalPagar");
	const statusBadge = document.getElementById("statusBadge");

	// ======= Constantes negocio =======
	const PLAZO_DIAS = 35;
	const K_PAR = 20;
	const K_IMPAR = 15;

	// ======= Endpoints (ajuste aquí) =======
	const API_CUSTOMER_BY_CUI = (cuiVal) => `/api/clientes/${encodeURIComponent(cuiVal)}`;
	const API_CREATE_LOAN = `/api/prestamo/nuevo`;

	// ======= Estado interno =======
	let customerFound = false;
	let customerData = null;

	// ======= Helpers =======
	const moneyInt = (n) => {
		const value = Math.round(Number(n || 0));
		return new Intl.NumberFormat("es-GT", { maximumFractionDigits: 0 }).format(value);
	};
	const moneyQ = (n) => `Q ${moneyInt(n)}`;

	function normalizeCui(input) {
		return String(input || "")
			.replaceAll("_", "")
			.replaceAll(" ", "")
			.replaceAll("\t", "")
			.replace(/\D/g, "");
	}

	// Replica exacta de retornados.fn_vcui
	function fn_vcui_js(ncui) {
		const cuiVal = normalizeCui(ncui);
		let vreturn = 9;

		if (cuiVal.length === 13) {
			let sverificador = 0;
			for (let pos = 1; pos <= 8; pos++) {
				const digit = Number(cuiVal.substring(pos - 1, pos));
				sverificador += (pos + 1) * digit; // peso = POS+1
			}
			const dverificador = sverificador % 11;
			const verificadorReal = Number(cuiVal.substring(8, 9)); // 9no dígito

			vreturn = dverificador === verificadorReal ? 1 : 3;
		} else {
			vreturn = 8;
		}

		return vreturn;
	}

	function todayLocalYYYYMMDD() {
		// Evita problemas de UTC (toISOString) en GT
		const d = new Date();
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, "0");
		const day = String(d.getDate()).padStart(2, "0");
		return `${y}-${m}-${day}`;
	}

	function calcular(principal) {
		const N = principal / 500;
		const par = Math.ceil(N / 2);
		const impar = N - par;
		const cuota = Math.ceil(K_PAR * par + K_IMPAR * impar);
		const total = cuota * PLAZO_DIAS;
		return { N, par, impar, cuota, total };
	}

	function setCuiStatus(kind, text, badgeText) {
		// kind: "ok" | "warn" | "bad" | "info"
		if (!cuiStatusWrap || !cuiStatusBadge || !cuiStatusText) return;

		cuiStatusWrap.style.display = "block";
		cuiStatusText.textContent = text || "";

		// limpiar clases
		cuiStatusBadge.className = "badge";
		if (kind === "ok") cuiStatusBadge.classList.add("gc-paid");
		else if (kind === "warn") cuiStatusBadge.classList.add("gc-late");
		else if (kind === "bad") cuiStatusBadge.classList.add("gc-default");
		else cuiStatusBadge.classList.add("badge-light");

		cuiStatusBadge.textContent = badgeText || "—";
	}

	function showNewCustomer(show) {
		if (nuevoClienteWrap) nuevoClienteWrap.style.display = show ? "block" : "none";
	}

	function showExistingCustomer(show) {
		if (clienteExistenteCard) clienteExistenteCard.style.display = show ? "block" : "none";
	}

	function clearCustomerBlocks() {
		customerFound = false;
		customerData = null;
		showExistingCustomer(false);
		showNewCustomer(false);

		if (clienteExistenteNombre) clienteExistenteNombre.textContent = "—";
		if (clienteExistenteDetalle) clienteExistenteDetalle.textContent = "—";
	}

	function clearErrors() {
		if (cuiError) cuiError.textContent = "";
		if (fechaPrestamoError) fechaPrestamoError.textContent = "";

		if (nombresError) nombresError.textContent = "";
		if (apellidosError) apellidosError.textContent = "";
		if (direccionError) direccionError.textContent = "";
		if (telefonoError) telefonoError.textContent = "";
		if (carteraError) carteraError.textContent = "";
	}

	function validatefechaPrestamo() {
		if (!fechaPrestamo) return true;

		const val = (fechaPrestamo.value || "").trim();
		if (!val) {
			fechaPrestamoError && (fechaPrestamoError.textContent = "La fecha de inicio es obligatoria.");
			return false;
		}
		fechaPrestamoError && (fechaPrestamoError.textContent = "");
		return true;
	}

	function validateNewCustomerFields() {
		// Solo aplica si el cliente NO existe
		if (customerFound) return true;
		if (!nuevoClienteWrap || nuevoClienteWrap.style.display === "none") return true;

		let ok = true;

		const vNombres = (nombres?.value || "").trim();
		const vApellidos = (apellidos?.value || "").trim();
		const vDireccion = (direccion?.value || "").trim();
		const vTelefono = (telefono?.value || "").trim();
		const vCartera = (cartera?.value || "").trim();

		if (!vNombres || vNombres.length < 2) {
			nombresError && (nombresError.textContent = "Nombres es obligatorio.");
			ok = false;
		} else nombresError && (nombresError.textContent = "");

		if (!vApellidos || vApellidos.length < 2) {
			apellidosError && (apellidosError.textContent = "Apellidos es obligatorio.");
			ok = false;
		} else apellidosError && (apellidosError.textContent = "");

		if (!vDireccion || vDireccion.length < 5) {
			direccionError && (direccionError.textContent = "Dirección es obligatoria.");
			ok = false;
		} else direccionError && (direccionError.textContent = "");

		// Teléfono: validación suave (solo requerido)
		if (!vTelefono || vTelefono.length < 7) {
			telefonoError && (telefonoError.textContent = "Teléfono es obligatorio.");
			ok = false;
		} else telefonoError && (telefonoError.textContent = "");

		if (!vCartera) {
			carteraError && (carteraError.textContent = "Seleccione una cartera.");
			ok = false;
		} else carteraError && (carteraError.textContent = "");

		return ok;
	}

	function validateCui() {
		const cuiVal = normalizeCui(cui?.value).slice(0, 13);
		if (cui && cui.value !== cuiVal) cui.value = cuiVal;

		if (!cuiVal) {
			cuiError && (cuiError.textContent = "El CUI es obligatorio.");
			setCuiStatus("bad", "", "CUI requerido");
			return { ok: false, cuiVal, code: 0 };
		}

		const code = fn_vcui_js(cuiVal);

		if (code === 8) {
			cuiError && (cuiError.textContent = "El CUI debe tener exactamente 13 dígitos.");
			setCuiStatus("bad", "", "13 dígitos");
			return { ok: false, cuiVal, code };
		}
		if (code === 3) {
			cuiError && (cuiError.textContent = "CUI inválido: dígito verificador incorrecto.");
			setCuiStatus("bad", "", "Inválido");
			return { ok: false, cuiVal, code };
		}
		if (code === 1) {
			cuiError && (cuiError.textContent = "");
			setCuiStatus("ok", "CUI válido. Puede buscar o continuar.", "Válido");
			return { ok: true, cuiVal, code };
		}

		cuiError && (cuiError.textContent = "CUI inválido.");
		setCuiStatus("bad", "", "Inválido");
		return { ok: false, cuiVal, code };
	}

	function renderCalcsAndSummary(cuiVal, displayName) {
		const principal = Number(cantidad?.value || 500);
		if (amountPill) amountPill.textContent = moneyQ(principal);

		const calc = calcular(principal);
		if (uiCuota) uiCuota.textContent = moneyQ(calc.cuota);
		if (uiTotal) uiTotal.textContent = moneyQ(calc.total);

		if (sumCui) sumCui.textContent = cuiVal || "—";
		if (sumNombre) sumNombre.textContent = displayName || "—";
		if (sumPrincipal) sumPrincipal.textContent = moneyQ(principal);
		if (sumCuota) sumCuota.textContent = moneyQ(calc.cuota);
		if (sumTotal) sumTotal.textContent = moneyQ(calc.total);

		return { principal, calc };
	}

	function getDisplayName() {
		if (customerFound && customerData) {
			return (
				customerData.NombreCompleto.toUpperCase() ||
				`${customerData.nombres.toUpperCase() || ""} ${customerData.apellidos.toUpperCase() || ""}`.trim() ||
				"—"
			);
		}

		const vN = (nombres?.value || "").trim();
		const vA = (apellidos?.value || "").trim();
		const combined = `${vN} ${vA}`.trim().toUpperCase();
		return combined || "—";
	}

	function setReadyPill(ok) {
		if (pillStatus) pillStatus.style.display = ok ? "inline-flex" : "none";
	}

	function setFormStatusBadge(text, kind) {
		if (!statusBadge) return;
		statusBadge.className = "badge";
		if (kind === "ok") statusBadge.classList.add("gc-paid");
		else if (kind === "warn") statusBadge.classList.add("gc-late");
		else if (kind === "bad") statusBadge.classList.add("gc-default");
		else statusBadge.classList.add("badge-light");
		statusBadge.textContent = text;
	}

	async function buscarClientePorCui() {
		const { ok, cuiVal } = validateCui();
		if (!ok) {
			clearCustomerBlocks();
			updateAll();
			return;
		}

		setCuiStatus("info", "Buscando cliente...", "Buscando");
		setFormStatusBadge("Buscando cliente…", "warn");

		try {
			const res = await fetch(API_CUSTOMER_BY_CUI(cuiVal), { headers: { Accept: "application/json" } });

			if (res.status === 404) {
				// No existe
				customerFound = false;
				customerData = null;

				showExistingCustomer(false);
				showNewCustomer(true);

				setCuiStatus("warn", "Cliente no encontrado. Complete datos para crearlo.", "Nuevo");
				setFormStatusBadge("Cliente nuevo", "warn");
				updateAll();
				return;
			}

			if (!res.ok) {
				throw new Error(`Error al buscar cliente (${res.status})`);
			}

			const {data} = await res.json();

			customerFound = true;
			customerData = data[0];

			showNewCustomer(false);
			showExistingCustomer(true);

			if (clienteExistenteNombre) {
				clienteExistenteNombre.textContent =
					data[0].nombre_completo || `${data[0].nombres || ""} ${data[0].apellidos || ""}`.trim() || "Cliente";
			}

			if (clienteExistenteDetalle) {
				const t = [];
				if (data[0].telefono) t.push(`Tel: ${data[0].telefono}`);
				if (data[0].direccion) t.push(data[0].direccion);
				clienteExistenteDetalle.textContent = t.join(" • ") || "Cliente existente en el sistema.";
			}

			setCuiStatus("ok", "Cliente encontrado.", "Existe");
			setFormStatusBadge("Cliente existente", "ok");
			updateAll();
		} catch (err) {
			console.error(err);
			setCuiStatus("bad", "No se pudo consultar el cliente. Intente nuevamente.", "Error");
			setFormStatusBadge("Error buscando cliente", "bad");
			clearCustomerBlocks();
			updateAll();
		}
	}

	function validateAll() {
		clearErrors();

		const cuiState = validateCui();
		const okFecha = validatefechaPrestamo();

		// Mostrar nombre en resumen:
		// - Si existe cliente: nombre del cliente
		// - Si no existe: nombres + apellidos (si los está llenando)
		const displayName = getDisplayName();

		// Cálculos / resumen
		const { principal, calc } = renderCalcsAndSummary(cuiState.cuiVal, displayName);

		// Validación adicional de cliente si es nuevo
		const okCliente = validateNewCustomerFields();

		// “ok global”:
		// - CUI válido
		// - Fecha inicio válida
		// - Si cliente nuevo, sus campos completos
		const ok = cuiState.ok && okFecha && okCliente;

		btnSubmit && (btnSubmit.disabled = !ok);
		setReadyPill(ok);

		if (!statusBadge) return { ok, cuiVal: cuiState.cuiVal, principal, calc, displayName };

		if (ok) setFormStatusBadge("Listo para guardar", "ok");
		else setFormStatusBadge("Pendiente", "warn");

		return { ok, cuiVal: cuiState.cuiVal, principal, calc, displayName };
	}

	function updateAll() {
		validateAll();
	}

	// ======= Eventos =======
	cui?.addEventListener("input", () => {
		// si cambia el CUI, invalidamos búsqueda previa
		clearCustomerBlocks();
		validateAll();
	});

	btnBuscarCui?.addEventListener("click", () => {
		buscarClientePorCui();
	});

	fechaPrestamo?.addEventListener("change", validateAll);
	cantidad?.addEventListener("input", validateAll);

	// Campos nuevo cliente (para habilitar botón cuando llenan)
	nombres?.addEventListener("input", validateAll);
	apellidos?.addEventListener("input", validateAll);
	direccion?.addEventListener("input", validateAll);
	telefono?.addEventListener("input", validateAll);
	cartera?.addEventListener("change", validateAll);
	observaciones?.addEventListener("input", validateAll);

	btnReset?.addEventListener("click", () => {
		form.reset();

		// Reset slider a base
		if (cantidad) cantidad.value = 500;

		// Fecha Prestamo: hoy (si quedó vacía tras reset)
		if (fechaPrestamo && !fechaPrestamo.value) fechaPrestamo.value = todayLocalYYYYMMDD();

		// Limpieza
		clearErrors();
		clearCustomerBlocks();
		setReadyPill(false);
		setFormStatusBadge("Pendiente", "warn");
		cuiStatusWrap && (cuiStatusWrap.style.display = "none");

		validateAll();
	});

	form.addEventListener("submit", async (e) => {
		e.preventDefault();

		const state = validateAll();
		if (!state.ok) return;

		// FormData para incluir archivos
		const fd = new FormData(form);

		// Adjuntar cálculos
		fd.set("principal", String(state.principal));
		fd.set("cuota_diaria", String(state.calc.cuota));
		fd.set("total_pagar", String(state.calc.total));
		fd.set("plazo_dias", String(PLAZO_DIAS));

		// Si el cliente existe, puede ser útil mandar customer_id o flag
		// Ajuste según su backend:
		if (customerFound && customerData?.id) {
			fd.set("customer_id", String(customerData.id));
		}

		// UX
		btnSubmit.textContent = "Guardando...";
		btnSubmit.disabled = true;
		setFormStatusBadge("Guardando…", "warn");

		try {
			const res = await fetch(API_CREATE_LOAN, {
				method: "POST",
				body: fd,
			});

			if (!res.ok) {
				const text = await res.text().catch(() => "");
				throw new Error(`Error al guardar (${res.status}). ${text}`);
			}

			setFormStatusBadge("Guardado ✔", "ok");
			btnSubmit.textContent = "Guardado ✔";

			// Aquí puede redirigir al detalle si su API devuelve el ID:
			const data = await res.json();
			window.location.href = `/prestamos/${data.prestamo_id}`;

			setTimeout(() => {
				btnSubmit.textContent = "Guardar préstamo";
				btnSubmit.disabled = false;
				validateAll();
			}, 1200);
		} catch (err) {
			console.error(err);
			setFormStatusBadge("Error al guardar", "bad");
			btnSubmit.textContent = "Guardar préstamo";
			btnSubmit.disabled = false;
			// Si usa SweetAlert2, aquí puede mostrarlo:
			Swal.fire({ text: err.message, icon: "error", confirmButtonText: "Ok", customClass: { confirmButton: "btn btn-primary" } });
		}
	});

	// ======= Init =======
	// Fecha Prestamo default
	if (fechaPrestamo && !fechaPrestamo.value) fechaPrestamo.value = todayLocalYYYYMMDD();

	// Estado inicial
	setFormStatusBadge("Pendiente", "warn");
	clearCustomerBlocks();
	validateAll();

	$("#cartera").select2({
		ajax: {
			url: "/api/ui/select2/cartera",
			dataType: "json",
			delay: 0,
			data: function (params) {
				return {
					like: params.term, // término de búsqueda
					page: params.page || 1,
					take: 10,
				};
			},
			processResults: function (data, params) {
				return {
					results: data.data.results, // [{id, text}]
					pagination: {more: data.data.pagination.more},
				};
			}
		}
	});
})();