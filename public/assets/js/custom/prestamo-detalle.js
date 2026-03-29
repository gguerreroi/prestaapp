(function () {
	// IMPORTANT: setear prestamo_id desde el EJS (ver más abajo)
	const prestamoId = window.__PRESTAMO_ID__;

	const btnPagar = document.getElementById('btnPagar');
	const payCount = document.getElementById('payCount');
	const checkAll = document.getElementById('checkAllCuotas');
	const checks = Array.from(document.querySelectorAll('.js-cuota-check'));

	const moneyQ = (n) =>
		new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ', maximumFractionDigits: 0 })
			.format(Number(n || 0));

	function getSelected() {
		const selected = checks
			.filter(c => !c.disabled && c.checked)
			.map(c => ({
				cuota: Number(c.dataset.cuota),
				importe: Number(c.dataset.importe || 0),
				mora: Number(c.dataset.mora || 0),
			}))
			.sort((a, b) => a.cuota - b.cuota);

		const cuotas = selected.map(x => x.cuota);
		const total = selected.reduce((acc, x) => acc + x.importe + x.mora, 0);

		return { selected, cuotas, total };
	}

	function renderState() {
		const { cuotas } = getSelected();
		const count = cuotas.length;

		payCount.textContent = String(count);
		btnPagar.disabled = count === 0;

		// CheckAll: solo marca si todas las habilitadas están checked
		const enabled = checks.filter(c => !c.disabled);
		const allChecked = enabled.length > 0 && enabled.every(c => c.checked);
		if (checkAll) checkAll.checked = allChecked;
	}

	// checkbox individual
	checks.forEach(c => c.addEventListener('change', renderState));

	// seleccionar todo
	if (checkAll) {
		checkAll.addEventListener('change', () => {
			const shouldCheck = checkAll.checked;
			checks.forEach(c => {
				if (!c.disabled) c.checked = shouldCheck;
			});
			renderState();
		});
	}

	// click pagar
	btnPagar.addEventListener('click', async () => {
		const { cuotas, total } = getSelected();
		if (cuotas.length === 0) return;

		// Confirmación con SweetAlert2 (Metronic)
		const ok = await Swal.fire({
			title: 'Confirmar pago',
			html: `
        <div class="text-start">
          <div><b>Préstamo:</b> #${prestamoId}</div>
          <div><b>Cuotas:</b> ${cuotas.join(', ')}</div>
          <div class="mt-2"><b>Total a pagar:</b> ${moneyQ(total)}</div>
        </div>
      `,
			icon: 'question',
			showCancelButton: true,
			confirmButtonText: 'Registrar',
			cancelButtonText: 'Cancelar',
			buttonsStyling: false,
			customClass: {
				confirmButton: "btn btn-primary",
				cancelButton: "btn btn-light"
			}
		}).then(r => r.isConfirmed);

		if (!ok) return;

		btnPagar.setAttribute('data-kt-indicator', 'on');
		btnPagar.disabled = true;

		try {
			const resp = await fetch(`/api/prestamo/${prestamoId}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ cuotas })
			});

			const data = await resp.json().catch(() => ({}));
			if (!resp.ok) {
				throw new Error(data?.message || 'No se pudo registrar el pago');
			}

			await Swal.fire({
				text: data?.message || 'Pago registrado',
				icon: 'success',
				buttonsStyling: false,
				confirmButtonText: "Ok",
				customClass: { confirmButton: "btn btn-primary" }
			});

			// Reload para refrescar estados
			window.location.reload();

		} catch (e) {
			Swal.fire({
				text: e.message || 'Error al registrar pago',
				icon: 'error',
				buttonsStyling: false,
				confirmButtonText: "Ok",
				customClass: { confirmButton: "btn btn-primary" }
			});
			renderState();
		} finally {
			btnPagar.removeAttribute('data-kt-indicator');
		}
	});

	// ─── Reversar pagos (solo admin) ───
	const btnReversar = document.getElementById('btnReversar');
	const reversarCount = document.getElementById('reversarCount');
	const checksReversar = Array.from(document.querySelectorAll('.js-cuota-reversar'));

	if (btnReversar && checksReversar.length > 0) {
		function getSelectedReversar() {
			return checksReversar
				.filter(c => c.checked)
				.map(c => ({
					cuota: Number(c.dataset.cuota),
					pagado: Number(c.dataset.pagado || 0),
				}))
				.sort((a, b) => a.cuota - b.cuota);
		}

		function renderReversarState() {
			const sel = getSelectedReversar();
			reversarCount.textContent = String(sel.length);
			btnReversar.disabled = sel.length === 0;
		}

		checksReversar.forEach(c => c.addEventListener('change', renderReversarState));

		btnReversar.addEventListener('click', async () => {
			const selected = getSelectedReversar();
			if (selected.length === 0) return;

			const cuotas = selected.map(x => x.cuota);
			const totalRevertir = selected.reduce((acc, x) => acc + x.pagado, 0);

			const ok = await Swal.fire({
				title: 'Reversar pagos',
				html: `
					<div class="text-start">
						<div class="alert alert-danger py-3 px-4 mb-3">
							<i class="bi bi-exclamation-triangle me-2"></i>
							Esta acción revertirá los pagos seleccionados.
						</div>
						<div><b>Préstamo:</b> #${prestamoId}</div>
						<div><b>Cuotas a reversar:</b> ${cuotas.join(', ')}</div>
						<div class="mt-2"><b>Total a revertir:</b> ${moneyQ(totalRevertir)}</div>
					</div>
				`,
				icon: 'warning',
				showCancelButton: true,
				confirmButtonText: 'Sí, reversar',
				cancelButtonText: 'Cancelar',
				buttonsStyling: false,
				customClass: {
					confirmButton: "btn btn-danger",
					cancelButton: "btn btn-light"
				}
			}).then(r => r.isConfirmed);

			if (!ok) return;

			btnReversar.disabled = true;

			try {
				const resp = await fetch(`/api/prestamo/${prestamoId}`, {
					method: 'DELETE',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ cuotas })
				});

				const data = await resp.json().catch(() => ({}));
				if (!resp.ok) {
					throw new Error(data?.message || 'No se pudo reversar el pago');
				}

				await Swal.fire({
					text: data?.message || 'Pagos reversados correctamente',
					icon: 'success',
					buttonsStyling: false,
					confirmButtonText: "Ok",
					customClass: { confirmButton: "btn btn-primary" }
				});

				window.location.reload();

			} catch (e) {
				Swal.fire({
					text: e.message || 'Error al reversar pago',
					icon: 'error',
					buttonsStyling: false,
					confirmButtonText: "Ok",
					customClass: { confirmButton: "btn btn-primary" }
				});
				renderReversarState();
			}
		});

		renderReversarState();
	}

	// ─── Cobro administrativo ───
	const btnCobrarAdmon = document.getElementById('btnCobrarAdmon');
	if (btnCobrarAdmon) {
		btnCobrarAdmon.addEventListener('click', async () => {
			const ok = await Swal.fire({
				title: 'Cobrar administrativo',
				text: 'Se registrara el cobro administrativo de este prestamo.',
				icon: 'question',
				showCancelButton: true,
				confirmButtonText: 'Si, cobrar',
				cancelButtonText: 'Cancelar',
				buttonsStyling: false,
				customClass: {
					confirmButton: "btn btn-success",
					cancelButton: "btn btn-light"
				}
			}).then(r => r.isConfirmed);

			if (!ok) return;

			btnCobrarAdmon.disabled = true;

			try {
				const resp = await fetch(`/api/prestamo/${prestamoId}/cobro-admon`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' }
				});

				const data = await resp.json().catch(() => ({}));
				if (!resp.ok) {
					throw new Error(data?.message || 'No se pudo registrar el cobro');
				}

				await Swal.fire({
					text: 'Cobro administrativo registrado',
					icon: 'success',
					buttonsStyling: false,
					confirmButtonText: "Ok",
					customClass: { confirmButton: "btn btn-primary" }
				});

				window.location.reload();

			} catch (e) {
				Swal.fire({
					text: e.message || 'Error al registrar cobro',
					icon: 'error',
					buttonsStyling: false,
					confirmButtonText: "Ok",
					customClass: { confirmButton: "btn btn-primary" }
				});
				btnCobrarAdmon.disabled = false;
			}
		});
	}

	// init
	renderState();
})();