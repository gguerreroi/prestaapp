"use strict";
// const btn = document.getElementById('kt_sign_in_submit');
// btn.disabled = true;
//
const url = `${window.location.origin}/api`;

// Class definition
var KTSigninGeneral = function() {
	// Elements
	var form;
	var submitButton;
	var validator;

	// Handle form
	var handleForm = function(e) {
		submitButton.removeAttribute('disabled')
		// Init form validation rules. For more info check the FormValidation plugin's official documentation:https://formvalidation.io/
		validator = FormValidation.formValidation(
			form,
			{
				fields: {
					'email': {
						validators: {
							notEmpty: {
								message: 'Email es obligatorio'
							},
							emailAddress: {
								message: 'Los datos ingresados no son un correo valido'
							}
						}
					},
					'password': {
						validators: {
							notEmpty: {
								message: 'Se necesita un password'
							}
						}
					}
				},
				plugins: {
					trigger: new FormValidation.plugins.Trigger(),
					bootstrap: new FormValidation.plugins.Bootstrap5({
						rowSelector: '.fv-row'
					})
				}
			}
		);

		// Handle form submit
		form.addEventListener('submit', function (e) {
			// Prevent button default action
			e.preventDefault();

			// Validate form
			validator.validate().then(function (status) {
				if (status == 'Valid') {
					// Show loading indication
					submitButton.setAttribute('data-kt-indicator', 'on');

					// Disable button to avoid multiple click
					submitButton.disabled = true;


					//const [user, entity] = document.getElementsByName('email')[0].value.split('@')
					const user = document.getElementsByName('email')[0].value;
					const pass = document.getElementsByName('password')[0].value

					$.ajax({
						url: `${url}/auth`,
						type: 'post',
						dataType: 'json',
						contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
						data: {
							username: user,
							password: pass
						}
					}).done(function(data){
						// set time out 1000ms
						setTimeout(function(){
							window.location.reload()
						}, 1)
					}).fail(function(error){
						//console.log("error fail: ", error)
						if (error.responseJSON != undefined){
							let {code, message, data} = error.responseJSON;


							if (data != undefined)
								message = data.message;

							Swal.fire({
								text: `${code} - ${message}`,
								icon: "error",
								buttonsStyling: false,
								confirmButtonText: "Ok",
								customClass: {
									confirmButton: "btn btn-primary"
								}
							});
						}

					}).always(function(){
						// Hide loading indication && Enable button
						submitButton.removeAttribute('data-kt-indicator');
						submitButton.disabled = false;
					})

				} else {
					// Show error popup. For more info check the plugin's official documentation: https://sweetalert2.github.io/
					Swal.fire({
						text: "Los datos de ingreso estan vacios",
						icon: "error",
						buttonsStyling: false,
						confirmButtonText: "Ok",
						customClass: {
							confirmButton: "btn btn-primary"
						}
					});
				}
			});
		});
	}

	// Public functions
	return {
		// Initialization
		init: function() {
			form = document.querySelector('#kt_sign_in_form');
			submitButton = document.querySelector('#kt_sign_in_submit');

			handleForm();
		}
	};
}();

document.addEventListener("DOMContentLoaded", function () {
	if (window.KTSigninGeneral && typeof KTSigninGeneral.init === "function") {
		KTSigninGeneral.init();
	}
});