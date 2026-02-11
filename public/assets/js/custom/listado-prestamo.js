"use strict";

(function () {
	const tableEl = document.getElementById("dtPrestamos");
	if (!tableEl) return;

	const endpoint = "/api/ui/datatables/prestamos_listado";

	const $table = $(tableEl);

	// helpers
	const moneyQ = (n) =>
		new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ", maximumFractionDigits: 0 })
			.format(Number(n || 0));

	const fmtDate = (d) => {
		if (!d) return "-";
		// fechas tipo DATE: usar UTC para no “correr” un día
		return new Date(d).toLocaleDateString("es-GT", {
			timeZone: "UTC",
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		});
	};

	const badgeEstadoPrestamo = (st) => {
		const s = String(st || "").toUpperCase();
		if (s === "PAGADO") return "badge-light-success";
		if (s === "ANULADO") return "badge-light-secondary";
		if (s === "ACTIVO") return "badge-light-primary";
		return "badge-light";
	};

	const badgeAtrasos = (n) => {
		const v = Number(n || 0);
		if (v > 0) return `<span class="badge gc-late">Sí (${v})</span>`;
		return `<span class="badge gc-paid">No</span>`;
	};

	// DataTables init
	const dt = $table.DataTable({
		processing: true,
		serverSide: true,
		searching: true,    // DataTables manda search[value]
		ordering: true,
		lengthMenu: [10, 25, 50, 100],
		pageLength: 25,
		ajax: {
			url: endpoint,
			type: "GET",
			data: function (d) {
				// filtros extra (además del search global)
				d.estado = document.getElementById("fltEstado")?.value || "";
				d.atrasos = document.getElementById("fltAtrasos")?.value || "";
				// TIP: si quiere, puede mandar estos al backend y filtrar ahí.
			},
			error: function (xhr) {
				console.error("DataTables error:", xhr?.responseText || xhr);
			},
		},
		columns: [
			{ data: "prestamo_id", name: "prestamo_id" },

			{
				data: null,
				name: "cliente_nombres",
				render: function (_, __, row) {
					const nombre = `${row.cliente_nombres || ""} ${row.cliente_apellidos || ""}`.trim();
					const tel = row.cliente_telefono ? `<div class="text-muted fs-8">Tel: ${row.cliente_telefono}</div>` : "";
					return `<div class="d-flex flex-column">
                    <span class="text-gray-800 fw-bold">${nombre || "-"}</span>
                    ${tel}
                  </div>`;
				},
			},

			{ data: "cui9", name: "cui9" },

			{
				data: "agente_nombre",
				name: "agente_nombre",
				render: function (data, _, row) {
					const a = data || `${row.agente_nombres || ""} ${row.agente_apellidos || ""}`.trim();
					return a || "-";
				},
			},

			{
				data: "fecha_inicio",
				name: "fecha_inicio",
				render: function (d) {
					return fmtDate(d);
				},
			},

			{
				data: "principal",
				name: "principal",
				className: "text-end",
				render: function (v) {
					return `<span class="fw-bold text-gray-800">${moneyQ(v)}</span>`;
				},
			},

			{
				data: "saldo",
				name: "saldo",
				className: "text-end",
				render: function (v) {
					const n = Number(v || 0);
					const cls = n > 0 ? "text-danger" : "text-success";
					return `<span class="fw-bold ${cls}">${moneyQ(n)}</span>`;
				},
			},

			{
				data: "estado",
				name: "estado",
				render: function (st) {
					return `<span class="badge ${badgeEstadoPrestamo(st)} text-uppercase">${st || "-"}</span>`;
				},
			},

			{
				data: "cuotas_atrasadas",
				name: "cuotas_atrasadas",
				className: "text-end",
				render: function (n) {
					return badgeAtrasos(n);
				},
			},

			{
				data: null,
				orderable: false,
				searchable: false,
				className: "text-end",
				render: function (_, __, row) {
					return `
            <a href="/prestamos/${row.prestamo_id}" class="btn btn-sm btn-light">
              Ver
            </a>
          `;
				},
			},
		],
		language: {
			processing: "Cargando...",
			lengthMenu: "Mostrar _MENU_",
			zeroRecords: "No hay préstamos",
			info: "Mostrando _START_ a _END_ de _TOTAL_",
			infoEmpty: "Mostrando 0 a 0 de 0",
			infoFiltered: "(filtrado de _MAX_ total)",
			paginate: { first: "Primero", last: "Último", next: "Siguiente", previous: "Anterior" },
			search: "",
			searchPlaceholder: "Buscar...",
		},
	});

	// Search input custom (arriba)
	const searchEl = document.getElementById("dtSearch");
	if (searchEl) {
		let t = null;
		searchEl.addEventListener("input", () => {
			clearTimeout(t);
			t = setTimeout(() => {
				dt.search(searchEl.value || "").draw();
			}, 250);
		});
	}

	// Reload
	const btnReload = document.getElementById("btnReload");
	if (btnReload) btnReload.addEventListener("click", () => dt.ajax.reload(null, false));

	// Filtros (en este ejemplo solo recargamos; para filtrar real, haga que backend use req.query.estado/atrasos)
	const fltEstado = document.getElementById("fltEstado");
	if (fltEstado) fltEstado.addEventListener("change", () => dt.ajax.reload());

	const fltAtrasos = document.getElementById("fltAtrasos");
	if (fltAtrasos) fltAtrasos.addEventListener("change", () => dt.ajax.reload());
})();