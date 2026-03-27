"use strict";

(function () {
	const tableEl = document.getElementById("kt_table_clientes");
	if (!tableEl) return;

	const searchInput = document.querySelector('[data-kt-clientes-table-filter="search"]');
	const estadoSelect = document.querySelector('[data-kt-clientes-table-filter="estado"]');
	const resetBtn = document.querySelector('[data-kt-clientes-table-filter="reset"]');

	const fmtEstado = (codigo) => {
		const c = (codigo || "").toString().toUpperCase();
		if (c === "AC") return `<span class="badge gc-paid">ACTIVO</span>`;
		if (c === "IN") return `<span class="badge badge-light">INACTIVO</span>`;
		if (c === "BL") return `<span class="badge gc-late">BLOQUEADO</span>`;
		return `<span class="badge badge-light">${c || "-"}</span>`;
	};

	const dt = $(tableEl).DataTable({
		processing: true,
		serverSide: true,
		searchDelay: 350,
		pageLength: 25,
		lengthMenu: [10, 25, 50, 100],
		order: [[0, "desc"]],
		ajax: {
			url: "/api/ui/datatables/clientes_listado",
			type: "GET",
			data: function (d) {
				// filtros extra
				d.estado = estadoSelect ? (estadoSelect.value || "") : "";
			},
			dataSrc: function (json) {
				// si su endpoint ya retorna el formato DataTables, esto funciona directo
				return json.data || [];
			}
		},
		columns: [
			{ data: "cui9", name: "cui9" },

			// Cliente (nombres + apellidos)
			{
				data: null,
				name: "cliente_nombres",
				render: function (data, type, row) {
					const nombres = row.cliente_nombres || row.nombres || "";
					const apellidos = row.cliente_apellidos || row.apellidos || "";
					const full = `${nombres} ${apellidos}`.trim() || "-";
					const id = row.cui9 || row.cliente_cui9 || "";

					return `
            <div class="d-flex flex-column">
              <a href="/clientes/${id}" class="text-gray-800 text-hover-primary fw-bold">${full}</a>
              <span class="text-muted fs-7">${row.cliente_direccion || row.direccion || ""}</span>
            </div>
          `;
				}
			},

			// CUI (13 dígitos)
			{
				data: null,
				name: "cliente_cui4",
				render: function (data, type, row) {
					// soporta ambos: separado (cui9 + cui4) o ya armado (cui)
					const cui9 = row.cui9 || row.cliente_cui9 || "";
					const cui4 = row.cliente_cui4 || row.cui4 || "";
					const cui = row.cui || (cui9 && cui4 ? `${cui9}${cui4}` : cui9);

					// formateo #### ####V #### (si viene 13)
					const digits = (cui || "").toString().replace(/\D/g, "");
					if (digits.length === 13) {
						const a = digits.slice(0, 4);
						const b = digits.slice(4, 9); // incluye verificador
						const c = digits.slice(9, 13);
						return `<span class="text-gray-800">${a} ${b} ${c}</span>`;
					}
					return `<span class="text-gray-800">${cui || "-"}</span>`;
				}
			},

			{ data: "cliente_telefono", name: "cliente_telefono", defaultContent: "-" },

			// Cartera / Agente
			{
				data: "agente_nombre",
				name: "agente_nombre",
				render: function (data, type, row) {
					const txt =
						row.agente_nombre ||
						row.cartera ||
						row.cliente_cartera ||
						"-";
					return `<span class="text-gray-800">${txt}</span>`;
				}
			},

			// Estado
			{
				data: "cliente__estado",
				name: "cliente__estado",
				render: function (data) {
					return fmtEstado(data);
				}
			},

			// Acciones
			{
				data: null,
				orderable: false,
				searchable: false,
				className: "text-end",
				render: function (data, type, row) {
					const id = row.cui9 || row.cliente_cui9 || "";
					return `
            <a href="/clientes/${id}" class="btn btn-sm btn-light">
              Ver
            </a>
          `;
				}
			}
		]
	});

	// Search input -> DataTables search
	if (searchInput) {
		searchInput.addEventListener("keyup", function () {
			dt.search(this.value).draw();
		});
	}

	// Estado filter
	if (estadoSelect) {
		estadoSelect.addEventListener("change", function () {
			dt.ajax.reload();
		});
	}

	// Reset
	if (resetBtn) {
		resetBtn.addEventListener("click", function () {
			if (searchInput) searchInput.value = "";
			if (estadoSelect) estadoSelect.value = "";
			dt.search("").draw();
			dt.ajax.reload();
		});
	}

	// Row click (opcional): click en fila abre detalle
	$(tableEl).on("click", "tbody tr", function (e) {
		// evitar que un click a un botón dispare esto
		if ($(e.target).closest("a,button").length) return;

		const row = dt.row(this).data();
		const id = row?.cui9 || row?.cliente_cui9;
		if (id) window.location.href = `/clientes/${id}`;
	});
})();