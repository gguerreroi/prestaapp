"use strict";

(function () {
	const tbody = document.getElementById("tbodyCobros");
	const btnAgregar = document.getElementById("btnAgregar");
	if (!tbody) return;

	const API = "/api/configuracion/cobros-administrativos";

	const moneyQ = (n) =>
		"Q " + Number(n || 0).toLocaleString("es-GT");

	// ─── Cargar datos ───
	async function cargar() {
		tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-8"><span class="spinner-border spinner-border-sm me-2"></span> Cargando...</td></tr>';

		try {
			const resp = await fetch(API, { credentials: "same-origin" });
			const json = await resp.json();

			if (json.code !== "OK" || !json.data?.length) {
				tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-8">No hay registros.</td></tr>';
				return;
			}

			tbody.innerHTML = json.data.map(r => `
				<tr>
					<td class="fw-bold text-gray-800">${r.Id}</td>
					<td class="text-end">${moneyQ(r.monto_minimo)}</td>
					<td class="text-end">${moneyQ(r.monto_maximo)}</td>
					<td class="text-end fw-bold text-primary">${moneyQ(r.cobro_admon)}</td>
					<td class="text-end">
						<button class="btn btn-sm btn-light-primary me-1 btn-editar"
							data-id="${r.Id}"
							data-min="${r.monto_minimo}"
							data-max="${r.monto_maximo}"
							data-cobro="${r.cobro_admon}">
							<i class="bi bi-pencil"></i>
						</button>
						<button class="btn btn-sm btn-light-danger btn-eliminar" data-id="${r.Id}">
							<i class="bi bi-trash"></i>
						</button>
					</td>
				</tr>
			`).join("");

		} catch (err) {
			console.error("Error cargando cobros:", err);
			tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger py-8">Error al cargar datos.</td></tr>';
		}
	}

	// ─── Modal para crear/editar ───
	async function mostrarModal(datos = null) {
		const esEditar = datos !== null;
		const titulo = esEditar ? "Editar cobro administrativo" : "Nuevo cobro administrativo";

		const result = await Swal.fire({
			title: titulo,
			html: `
				<div class="text-start">
					<div class="mb-3">
						<label class="form-label fw-semibold">Monto Minimo</label>
						<input id="swal-min" type="number" class="form-control" value="${datos?.min || ''}" placeholder="500" />
					</div>
					<div class="mb-3">
						<label class="form-label fw-semibold">Monto Maximo</label>
						<input id="swal-max" type="number" class="form-control" value="${datos?.max || ''}" placeholder="3000" />
					</div>
					<div class="mb-3">
						<label class="form-label fw-semibold">Cobro Administrativo</label>
						<input id="swal-cobro" type="number" class="form-control" value="${datos?.cobro || ''}" placeholder="25" />
					</div>
				</div>
			`,
			showCancelButton: true,
			confirmButtonText: esEditar ? "Guardar" : "Crear",
			cancelButtonText: "Cancelar",
			buttonsStyling: false,
			customClass: {
				confirmButton: "btn btn-primary",
				cancelButton: "btn btn-light"
			},
			preConfirm: () => {
				const monto_minimo = document.getElementById("swal-min").value;
				const monto_maximo = document.getElementById("swal-max").value;
				const cobro_admon = document.getElementById("swal-cobro").value;

				if (!monto_minimo || !monto_maximo || !cobro_admon) {
					Swal.showValidationMessage("Todos los campos son requeridos");
					return false;
				}
				return { monto_minimo: Number(monto_minimo), monto_maximo: Number(monto_maximo), cobro_admon: Number(cobro_admon) };
			}
		});

		if (!result.isConfirmed) return;

		try {
			const url = esEditar ? `${API}/${datos.id}` : API;
			const method = esEditar ? "PUT" : "POST";

			const resp = await fetch(url, {
				method,
				credentials: "same-origin",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(result.value)
			});

			const json = await resp.json();

			if (!resp.ok) {
				throw new Error(json?.message || "Error en la operacion");
			}

			Swal.fire({
				text: json.message || "Operacion exitosa",
				icon: "success",
				buttonsStyling: false,
				confirmButtonText: "Ok",
				customClass: { confirmButton: "btn btn-primary" }
			});

			cargar();

		} catch (err) {
			Swal.fire({
				text: err.message || "Error",
				icon: "error",
				buttonsStyling: false,
				confirmButtonText: "Ok",
				customClass: { confirmButton: "btn btn-primary" }
			});
		}
	}

	// ─── Eliminar ───
	async function eliminar(id) {
		const ok = await Swal.fire({
			title: "Eliminar registro",
			text: "Esta accion no se puede deshacer.",
			icon: "warning",
			showCancelButton: true,
			confirmButtonText: "Si, eliminar",
			cancelButtonText: "Cancelar",
			buttonsStyling: false,
			customClass: {
				confirmButton: "btn btn-danger",
				cancelButton: "btn btn-light"
			}
		}).then(r => r.isConfirmed);

		if (!ok) return;

		try {
			const resp = await fetch(`${API}/${id}`, {
				method: "DELETE",
				credentials: "same-origin"
			});

			const json = await resp.json();

			if (!resp.ok) {
				throw new Error(json?.message || "Error al eliminar");
			}

			Swal.fire({
				text: "Registro eliminado",
				icon: "success",
				buttonsStyling: false,
				confirmButtonText: "Ok",
				customClass: { confirmButton: "btn btn-primary" }
			});

			cargar();

		} catch (err) {
			Swal.fire({
				text: err.message || "Error",
				icon: "error",
				buttonsStyling: false,
				confirmButtonText: "Ok",
				customClass: { confirmButton: "btn btn-primary" }
			});
		}
	}

	// ─── Event listeners ───
	btnAgregar.addEventListener("click", () => mostrarModal());

	tbody.addEventListener("click", (e) => {
		const btnEdit = e.target.closest(".btn-editar");
		if (btnEdit) {
			mostrarModal({
				id: btnEdit.dataset.id,
				min: btnEdit.dataset.min,
				max: btnEdit.dataset.max,
				cobro: btnEdit.dataset.cobro
			});
			return;
		}

		const btnDel = e.target.closest(".btn-eliminar");
		if (btnDel) {
			eliminar(btnDel.dataset.id);
		}
	});

	// ─── Init ───
	cargar();
})();
