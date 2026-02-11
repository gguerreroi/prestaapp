"use strict";

(function () {
	const carteraId = window.__CARTERA_ID__; // <-- inyectado desde el servidor, si aplica
	const carteraNombre = window.__CARTERA_NOMBRE__; // <-- inyectado desde el servidor, si aplica

	const form = document.getElementById("formClienteEdit");
	if (!form) return;

	const btnSave = document.getElementById("btnSaveCliente");
	const cui9 = document.getElementById("edit_cui9")?.value;

	const selCartera = document.getElementById("edit_cartera_id");

	// Este valor lo “inyectamos” desde un atributo data si quiere,
	// pero aquí lo leemos de un input hidden opcional.
	const carteraActual = Number(carteraId || 0) || null;

	// ===== Helpers =====
	const setLoading = (isLoading) => {
		if (!btnSave) return;
		if (isLoading) {
			btnSave.setAttribute("data-kt-indicator", "on");
			btnSave.disabled = true;
		} else {
			btnSave.removeAttribute("data-kt-indicator");
			btnSave.disabled = false;
		}
	};

	const toastError = (msg) => {
		if (window.Swal) {
			Swal.fire({
				text: msg || "Ocurrió un error",
				icon: "error",
				buttonsStyling: false,
				confirmButtonText: "Ok",
				customClass: { confirmButton: "btn btn-primary" },
			});
			return;
		}
		alert(msg || "Error");
	};

	// ===== Cargar cartera (agentes) =====
	async function loadCarteras() {
		if (!selCartera) return;

		const view = "cartera"; // <-- su sufijo: ui.vw_select2_agentes

		try {
			$("#edit_cartera_id").select2({
				ajax: {
					url: `/api/ui/select2/${view}`,
					dataType: "json",
					delay: 50,
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
					},
					cache: true,
				},
				placeholder: "Seleccione una cartera",
				minimumInputLength: 0,
			});

			// set actual si existe
			if (carteraActual) {
				const option = new Option(carteraNombre, carteraActual, true, true);

				$("#edit_cartera_id").append(option).trigger("change");
			}
		} catch (e) {
			console.error(e);
			// No bloquear la edición si falla, solo avisar.
			toastError(e.message);
		}
	}

	// ===== Submit =====
	form.addEventListener("submit", async (e) => {
		e.preventDefault();
		if (!cui9) return toastError("CUI9 inválido");

		const payload = {
			nombres: document.getElementById("edit_nombres")?.value?.trim() || "",
			apellidos: document.getElementById("edit_apellidos")?.value?.trim() || "",
			direccion: document.getElementById("edit_direccion")?.value?.trim() || null,
			telefono: document.getElementById("edit_telefono")?.value?.trim() || null,
			cartera_id: selCartera?.value ? Number(selCartera.value) : null,
			referencias_vivienda: document.getElementById("edit_referencias_vivienda")?.value?.trim() || null,
			observaciones: document.getElementById("edit_observaciones")?.value?.trim() || null,
		};

		if (!payload.nombres || payload.nombres.length < 2) return toastError("Nombres es obligatorio");
		if (!payload.apellidos || payload.apellidos.length < 2) return toastError("Apellidos es obligatorio");

		setLoading(true);

		try {
			const r = await fetch(`/api/clientes/${encodeURIComponent(cui9)}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			const j = await r.json().catch(() => ({}));
			if (!r.ok) throw new Error(j?.message || "No se pudo guardar");

			// cerrar modal
			const modalEl = document.getElementById("kt_modal_cliente_edit");
			if (modalEl && window.bootstrap) {
				const instance = window.bootstrap.Modal.getInstance(modalEl) || new window.bootstrap.Modal(modalEl);
				instance.hide();
			}

			// refrescar para ver cambios
			window.location.reload();
		} catch (err) {
			console.error(err);
			toastError(err.message);
		} finally {
			setLoading(false);
		}
	});

	// init
	loadCarteras();
})();