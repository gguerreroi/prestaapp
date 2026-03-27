"use strict";

(function () {
	const tableEl = document.getElementById("dtCobranza");
	if (!tableEl) return;

	const endpoint = "/api/cobranza/listado";
	const $table = $(tableEl);

	// helpers
	const moneyQ = (n) =>
		new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ", maximumFractionDigits: 0 })
			.format(Number(n || 0));

	const badgeEstado = (st) => {
		const s = String(st || "").toUpperCase();
		if (s === "PAGADO") return "badge-light-success";
		if (s === "ANULADO") return "badge-light-secondary";
		if (s === "ACTIVO") return "badge-light-primary";
		return "badge-light";
	};

	const badgeAtrasos = (n) => {
		const v = Number(n || 0);
		if (v > 0) return `<span class="badge badge-light-danger">${v}</span>`;
		return `<span class="badge badge-light-success">0</span>`;
	};

	// DataTables init
	const dt = $table.DataTable({
		processing: true,
		serverSide: true,
		searching: true,
		ordering: true,
		lengthMenu: [10, 25, 50, 100],
		pageLength: 25,
		ajax: {
			url: endpoint,
			type: "GET",
			data: function (d) {
				d.estado = document.getElementById("fltEstado")?.value || "";
			},
			error: function (xhr) {
				console.error("DataTables error:", xhr?.responseText || xhr);
			},
		},
		columns: [
			{
				data: "prestamo_id",
				name: "prestamo_id",
				render: function (id) {
					return `<a href="/prestamos/${id}" class="text-gray-800 fw-bold text-hover-primary">#${id}</a>`;
				},
			},

			{
				data: null,
				name: "cliente_nombres",
				render: function (_, __, row) {
					const nombre = `${row.cliente_nombres || ""} ${row.cliente_apellidos || ""}`.trim();
					const tel = row.cliente_telefono
						? `<div class="text-muted fs-8">Tel: ${row.cliente_telefono}</div>`
						: "";
					return `<div class="d-flex flex-column">
						<span class="text-gray-800 fw-bold">${nombre || "-"}</span>
						${tel}
					</div>`;
				},
			},

			{
				data: "agente_nombre",
				name: "agente_nombre",
				render: function (data) {
					return data || "-";
				},
			},

			{
				data: "cuota_diaria",
				name: "cuota_diaria",
				className: "text-end",
				render: function (v) {
					return `<span class="fw-bold">${moneyQ(v)}</span>`;
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
				data: null,
				name: "cuotas_pagadas",
				className: "text-center",
				render: function (_, __, row) {
					const pagadas = Number(row.cuotas_pagadas || 0);
					const total = Number(row.plazo_dias || 0);
					const pct = total > 0 ? Math.round((pagadas / total) * 100) : 0;
					const color = pct >= 100 ? "bg-success" : pct >= 50 ? "bg-primary" : "bg-warning";
					return `<div class="d-flex flex-column align-items-center">
						<span class="fs-7 fw-bold">${pagadas} de ${total}</span>
						<div class="progress h-6px w-60px mt-1">
							<div class="progress-bar ${color}" style="width: ${pct}%"></div>
						</div>
					</div>`;
				},
			},

			{
				data: "cuotas_atrasadas",
				name: "cuotas_atrasadas",
				className: "text-center",
				render: function (n) {
					return badgeAtrasos(n);
				},
			},

			{
				data: "estado",
				name: "estado",
				render: function (st) {
					return `<span class="badge ${badgeEstado(st)} text-uppercase">${st || "-"}</span>`;
				},
			},

			{
				data: null,
				orderable: false,
				searchable: false,
				className: "text-end",
				render: function (_, __, row) {
					return `<a href="/prestamos/${row.prestamo_id}" class="btn btn-sm btn-light">Ver</a>`;
				},
			},
		],
		language: {
			processing: "Cargando...",
			lengthMenu: "Mostrar _MENU_",
			zeroRecords: "No hay registros de cobranza",
			info: "Mostrando _START_ a _END_ de _TOTAL_",
			infoEmpty: "Mostrando 0 a 0 de 0",
			infoFiltered: "(filtrado de _MAX_ total)",
			paginate: { first: "Primero", last: "\u00DAltimo", next: "Siguiente", previous: "Anterior" },
			search: "",
			searchPlaceholder: "Buscar...",
		},
	});

	// Search input custom
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

	// Filtro estado
	const fltEstado = document.getElementById("fltEstado");
	if (fltEstado) fltEstado.addEventListener("change", () => dt.ajax.reload());
})();
