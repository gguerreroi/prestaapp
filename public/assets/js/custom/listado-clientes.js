"use strict";

(function () {
	const tableEl = document.getElementById("kt_table_clientes");
	if (!tableEl) return;

	const searchInput = document.querySelector('[data-kt-clientes-table-filter="search"]');
	const estadoSelect = document.querySelector('[data-kt-clientes-table-filter="estado"]');
	const resetBtn = document.querySelector('[data-kt-clientes-table-filter="reset"]');
	const fltAgente = document.getElementById("fltAgente");

	// Cargar agentes en el select
	if (fltAgente) {
		fetch("/api/ui/select2/cartera?take=50", { credentials: "same-origin" })
			.then(r => r.json())
			.then(res => {
				const items = res?.data?.results || [];
				items.forEach(item => {
					const opt = document.createElement("option");
					opt.value = item.id;
					opt.textContent = item.text;
					fltAgente.appendChild(opt);
				});
			})
			.catch(err => console.error("Error cargando agentes:", err));
	}

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
				const estado = estadoSelect ? (estadoSelect.value || "") : "";
				const agente = fltAgente ? (fltAgente.value || "") : "";

				if (estado) d.cliente__estado = estado;
				if (agente) d.agente_id = agente;
			},
			dataSrc: function (json) {
				return json.data || [];
			}
		},
		columns: [
			{ data: "cui9", name: "cui9" },

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

			{
				data: null,
				name: "cliente_cui4",
				render: function (data, type, row) {
					const cui9 = row.cui9 || row.cliente_cui9 || "";
					const cui4 = row.cliente_cui4 || row.cui4 || "";
					const cui = row.cui || (cui9 && cui4 ? `${cui9}${cui4}` : cui9);

					const digits = (cui || "").toString().replace(/\D/g, "");
					if (digits.length === 13) {
						const a = digits.slice(0, 4);
						const b = digits.slice(4, 9);
						const c = digits.slice(9, 13);
						return `<span class="text-gray-800">${a} ${b} ${c}</span>`;
					}
					return `<span class="text-gray-800">${cui || "-"}</span>`;
				}
			},

			{ data: "cliente_telefono", name: "cliente_telefono", defaultContent: "-" },

			{
				data: "agente_nombre",
				name: "agente_nombre",
				render: function (data, type, row) {
					const txt = row.agente_nombre || row.cartera || row.cliente_cartera || "-";
					return `<span class="text-gray-800">${txt}</span>`;
				}
			},

			{
				data: "cliente__estado",
				name: "cliente__estado",
				render: function (data) {
					return fmtEstado(data);
				}
			},

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

	// Search
	if (searchInput) {
		let t = null;
		searchInput.addEventListener("input", () => {
			clearTimeout(t);
			t = setTimeout(() => {
				dt.search(searchInput.value || "").draw();
			}, 250);
		});
	}

	// Filtros — recargan la tabla
	if (estadoSelect) estadoSelect.addEventListener("change", () => dt.ajax.reload());
	if (fltAgente) fltAgente.addEventListener("change", () => dt.ajax.reload());

	// Reset
	if (resetBtn) {
		resetBtn.addEventListener("click", function () {
			if (searchInput) searchInput.value = "";
			if (estadoSelect) estadoSelect.value = "";
			if (fltAgente) fltAgente.value = "";
			dt.search("").ajax.reload();
		});
	}

	// Row click
	$(tableEl).on("click", "tbody tr", function (e) {
		if ($(e.target).closest("a,button").length) return;
		const row = dt.row(this).data();
		const id = row?.cui9 || row?.cliente_cui9;
		if (id) window.location.href = `/clientes/${id}`;
	});
})();
