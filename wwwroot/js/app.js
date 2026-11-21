let chartInstance = null;
let casosGuardados = [];

document.addEventListener('DOMContentLoaded', () => {
    const selectCanton = document.getElementById('canton');
    const selectDistrito = document.getElementById('distrito');
    const btnCalcular = document.getElementById('btnCalcular');
    const btnUbicacion = document.getElementById('btnUbicacion');
    const btnGuardarCaso = document.getElementById('btnGuardarCaso');
    const btnExportarCasos = document.getElementById('btnExportarCasos');
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    const btnLogin = document.getElementById('btnLogin');
    const btnCerrarSesion = document.getElementById('btnCerrarSesion');
    let limitesAdministrativosPromise = null;

    setupToggles();
    setupModoTecnico();
    setupTabs();
    setupIlustracionFinca();
    renderizarListaCasos();

    function actualizarDistritos(distritoInicial) {
        const canton = selectCanton.value;
        const distritos = Calculator.distritosPorCanton[canton] || [];
        const distritoActual = distritoInicial === undefined ? selectDistrito.value : distritoInicial;

        selectDistrito.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Seleccione un distrito';
        selectDistrito.appendChild(placeholder);

        distritos.forEach(dist => {
            const opt = document.createElement('option');
            const claveLimpia = dist.toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/\s+/g, '_');

            opt.value = claveLimpia;
            opt.textContent = dist;
            selectDistrito.appendChild(opt);
        });

        const distritoExiste = distritos.some(dist => {
            const clave = dist.toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/\s+/g, '_');
            return clave === distritoActual;
        });

        if (distritoExiste) selectDistrito.value = distritoActual;
        else if (distritoInicial === '') selectDistrito.value = '';
        else if (distritos.length > 0) selectDistrito.selectedIndex = 1;

        actualizarBadgeConfianza();
    }

    function actualizarBadgeConfianza() {
        const distText = selectDistrito.value
            ? selectDistrito.options[selectDistrito.selectedIndex]?.text || ''
            : '';
        const badge = document.getElementById('badgeConfianza');
        if (badge) {
            const cantonText = selectCanton.options[selectCanton.selectedIndex]?.text || '';
            badge.textContent = `IMN / FAO: ${distText || `Cantón ${cantonText}`}`;
        }
    }

    function cargarLimitesAdministrativos() {
        if (!limitesAdministrativosPromise) {
            limitesAdministrativosPromise = fetch('./data/district-boundaries.json')
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`No se pudieron cargar los límites administrativos (${response.status}).`);
                    }
                    return response.json();
                })
                .then(limites => {
                    if (!limites || !limites.cantones || !Array.isArray(limites.districts)) {
                        throw new Error('El archivo de límites administrativos tiene un formato inválido.');
                    }
                    return limites;
                })
                .catch(error => {
                    limitesAdministrativosPromise = null;
                    throw error;
                });
        }

        return limitesAdministrativosPromise;
    }

    selectCanton.addEventListener('change', () => actualizarDistritos());
    selectDistrito.addEventListener('change', actualizarBadgeConfianza);

    actualizarDistritos('nicoya');

    // BOTÓN CALCULAR BALANCE: ÚNICO DISPARADOR DE LA GRÁFICA Y CÁLCULOS
    btnCalcular.addEventListener('click', () => {
        ejecutarCalculo();
        const tabResultados = document.getElementById('tab-resultados');
        tabResultados.click();
        tabResultados.focus();
    });

    document.getElementById('tipoGanado').addEventListener('change', (e) => {
        const tasa = Calculator.tasasGanado[e.target.value] || 50;
        document.getElementById('lblDotacionOficial').textContent = tasa;
    });

    btnGuardarCaso.addEventListener('click', async () => {
        const nombreFinca = document.getElementById('nombreFinca').value.trim() || "Finca sin nombre";
        const request = {
            nombre: nombreFinca,
            fecha: new Date().toLocaleDateString('es-CR'),
            params: capturarParametrosActuales()
        };

        btnGuardarCaso.disabled = true;
        try {
            const response = await fetch('/api/cases', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request)
            });
            if (response.status === 401) {
                mostrarPantallaAcceso('La sesión venció. Inicia sesión de nuevo.');
                return;
            }
            if (!response.ok) {
                throw new Error(`El servidor rechazó el caso (${response.status}).`);
            }

            await cargarCasosServidor();
            alert(`¡Caso "${nombreFinca}" guardado en el servidor!`);
        } catch (error) {
            console.error('No se pudo guardar el caso.', error);
            alert(`No se pudo guardar el caso: ${error.message}`);
        } finally {
            btnGuardarCaso.disabled = false;
        }
    });

    btnExportarCasos.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(casosGuardados, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Respaldo_Casos_CosechaAgua_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
    });

    btnUbicacion.addEventListener('click', () => {
        const estadoUbicacion = document.getElementById('estadoUbicacion');
        if (!navigator.geolocation) {
            const mensaje = "Este navegador no permite obtener la ubicación GPS.";
            estadoUbicacion.textContent = mensaje;
            alert(mensaje);
            return;
        }

        btnUbicacion.disabled = true;
        estadoUbicacion.textContent = "Solicitando ubicación actual...";

        navigator.geolocation.getCurrentPosition(
            async (posicion) => {
                const { latitude, longitude, accuracy } = posicion.coords;
                if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                    const mensaje = "El GPS devolvió coordenadas inválidas; no se cambió la ubicación seleccionada.";
                    estadoUbicacion.textContent = mensaje;
                    alert(mensaje);
                    btnUbicacion.disabled = false;
                    return;
                }

                estadoUbicacion.textContent = "Ubicación recibida; identificando cantón y distrito localmente...";
                try {
                    const limites = await cargarLimitesAdministrativos();
                    const ubicacion = Calculator.encontrarUbicacionGPS(latitude, longitude, limites);
                    if (!ubicacion) {
                        const mensaje = "No se encontró la ubicación dentro de los límites de los cantones disponibles; no se cambió la selección.";
                        estadoUbicacion.textContent = mensaje;
                        alert(mensaje);
                        return;
                    }

                    selectCanton.value = ubicacion.canton;
                    actualizarDistritos(ubicacion.distrito || '');
                    const cantonText = selectCanton.options[selectCanton.selectedIndex]?.text || ubicacion.canton;
                    const precision = Number.isFinite(accuracy) ? ` (precisión ±${Math.round(accuracy)} m)` : '';
                    if (ubicacion.distrito) {
                        const distritoText = selectDistrito.options[selectDistrito.selectedIndex]?.text || ubicacion.distrito;
                        estadoUbicacion.textContent = `GPS detectó ${distritoText}, cantón ${cantonText}, ${latitude.toFixed(5)}, ${longitude.toFixed(5)}${precision}.`;
                    } else {
                        estadoUbicacion.textContent = `Cantón ${cantonText} detectado, pero no se pudo identificar el distrito con los límites disponibles. Selecciónalo manualmente${precision}.`;
                    }
                } catch (error) {
                    console.error("No se pudieron resolver los límites administrativos para GPS.", error);
                    const mensaje = "No se pudieron cargar los límites administrativos; no se cambió la selección. Inténtalo de nuevo más tarde.";
                    estadoUbicacion.textContent = mensaje;
                    alert(mensaje);
                } finally {
                    btnUbicacion.disabled = false;
                }
            },
            (error) => {
                btnUbicacion.disabled = false;
                let mensaje;
                switch (error.code) {
                    case 1:
                        mensaje = "Permiso de ubicación denegado. Habilítalo en la configuración del navegador.";
                        break;
                    case 2:
                        mensaje = "No se pudo determinar la ubicación. Revisa la señal del dispositivo e inténtalo de nuevo.";
                        break;
                    case 3:
                        mensaje = "La solicitud de ubicación tardó demasiado. Inténtalo nuevamente.";
                        break;
                    default:
                        mensaje = "Ocurrió un error al obtener la ubicación GPS.";
                        break;
                }
                estadoUbicacion.textContent = mensaje;
                alert(mensaje);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    });

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        loginError.textContent = '';
        btnLogin.disabled = true;

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    usuario: document.getElementById('loginUsuario').value,
                    contrasena: document.getElementById('loginContrasena').value
                })
            });

            if (response.status === 401) {
                loginError.textContent = 'Usuario o contraseña incorrectos.';
                return;
            }
            if (response.status === 503) {
                loginError.textContent = 'La autenticación no está configurada en este servidor.';
                return;
            }
            if (!response.ok) {
                throw new Error(`El servidor respondió ${response.status}.`);
            }

            const session = await response.json();
            await cargarCasosServidor();
            mostrarAplicacion(session.username);
            loginForm.reset();
        } catch (error) {
            console.error('No se pudo iniciar sesión.', error);
            loginError.textContent = 'No se pudo iniciar sesión. Revisa la conexión con el servidor e inténtalo de nuevo.';
        } finally {
            btnLogin.disabled = false;
        }
    });

    btnCerrarSesion.addEventListener('click', async () => {
        btnCerrarSesion.disabled = true;
        try {
            const response = await fetch('/api/auth/logout', { method: 'POST' });
            if (!response.ok && response.status !== 401) {
                throw new Error(`El servidor respondió ${response.status}.`);
            }

            casosGuardados = [];
            renderizarListaCasos();
            mostrarPantallaAcceso('');
            loginForm.reset();
        } catch (error) {
            console.error('No se pudo cerrar la sesión.', error);
            alert('No se pudo cerrar la sesión. Inténtalo de nuevo.');
        } finally {
            btnCerrarSesion.disabled = false;
        }
    });

    async function verificarSesion() {
        try {
            const response = await fetch('/api/auth/session');
            if (!response.ok) {
                throw new Error(`El servidor respondió ${response.status}.`);
            }

            const session = await response.json();
            if (!session.authenticated) {
                mostrarPantallaAcceso('');
                return;
            }

            await cargarCasosServidor();
            mostrarAplicacion(session.username);
        } catch (error) {
            console.error('No se pudo verificar la sesión.', error);
            mostrarPantallaAcceso('No se pudo conectar con el servidor. Inténtalo de nuevo.');
        }
    }

    void verificarSesion();
});

function mostrarPantallaAcceso(mensaje) {
    const appShell = document.getElementById('appShell');
    appShell.hidden = true;
    appShell.inert = true;
    appShell.setAttribute('aria-hidden', 'true');
    document.getElementById('loginOverlay').hidden = false;
    document.getElementById('loginError').textContent = mensaje;
    document.getElementById('loginUsuario').focus();
}

function mostrarAplicacion(usuario) {
    const appShell = document.getElementById('appShell');
    appShell.hidden = false;
    appShell.inert = false;
    appShell.removeAttribute('aria-hidden');
    document.getElementById('loginOverlay').hidden = true;
    document.getElementById('usuarioActual').textContent = `Sesión: ${usuario}`;
    ejecutarCalculo();
}

async function cargarCasosServidor() {
    const response = await fetch('/api/cases');
    if (response.status === 401) {
        mostrarPantallaAcceso('La sesión venció. Inicia sesión de nuevo.');
        throw new Error('La sesión ya no está autenticada.');
    }
    if (!response.ok) {
        throw new Error(`No se pudieron cargar los casos (${response.status}).`);
    }

    casosGuardados = await response.json();
    renderizarListaCasos();
}

function capturarParametrosActuales() {
    return {
        nombreFinca: document.getElementById('nombreFinca').value,
        canton: document.getElementById('canton').value,
        distrito: document.getElementById('distrito').value,
        escenarioClima: document.getElementById('escenarioClima').value,
        areaTecho: document.getElementById('areaTecho').value,
        capacidadTanque: document.getElementById('capacidadTanque').value,
        material: document.getElementById('material').value,
        checkAnimales: document.getElementById('checkAnimales').checked,
        tipoGanado: document.getElementById('tipoGanado').value,
        cabezasBovinos: document.getElementById('cabezasBovinos').value,
        aguaLimpieza: document.getElementById('aguaLimpieza').value,
        checkCultivo: document.getElementById('checkCultivo').checked,
        tipoCultivo: document.getElementById('tipoCultivo').value,
        etapaFenologica: document.getElementById('etapaFenologica').value,
        areaCultivo: document.getElementById('areaCultivo').value,
        sistemaRiego: document.getElementById('sistemaRiego').value,
        checkAzolla: document.getElementById('checkAzolla').checked,
        areaAzolla: document.getElementById('areaAzolla').value,
        laminaAzolla: document.getElementById('laminaAzolla').value,
        fraccionAzolla: document.getElementById('fraccionAzolla').value,
        evaporacionAzolla: document.getElementById('evaporacionAzolla').value,
        infiltracionAzolla: document.getElementById('infiltracionAzolla').value,
        rangoAnios: document.getElementById('rangoAnios').value
    };
}

function cargarCaso(id) {
    const caso = casosGuardados.find(c => c.id === id);
    if (!caso) return;
    const p = caso.params;

    document.getElementById('nombreFinca').value = p.nombreFinca || "";
    document.getElementById('canton').value = p.canton || "nicoya";
    document.getElementById('canton').dispatchEvent(new Event('change'));
    document.getElementById('distrito').value = p.distrito || "";
    document.getElementById('escenarioClima').value = p.escenarioClima || "tipico";
    document.getElementById('areaTecho').value = p.areaTecho || 150;
    document.getElementById('capacidadTanque').value = p.capacidadTanque || 10;
    document.getElementById('material').value = p.material || "0.90";
    
    document.getElementById('checkAnimales').checked = p.checkAnimales ?? true;
    document.getElementById('checkAnimales').dispatchEvent(new Event('change'));
    document.getElementById('tipoGanado').value = p.tipoGanado || "bovino_carne";
    document.getElementById('cabezasBovinos').value = p.cabezasBovinos || 10;
    document.getElementById('aguaLimpieza').value = p.aguaLimpieza || 50;
    
    document.getElementById('checkCultivo').checked = p.checkCultivo ?? true;
    document.getElementById('checkCultivo').dispatchEvent(new Event('change'));
    document.getElementById('tipoCultivo').value = p.tipoCultivo || "pasto";
    document.getElementById('etapaFenologica').value = p.etapaFenologica || "media";
    document.getElementById('areaCultivo').value = p.areaCultivo || 1000;
    document.getElementById('sistemaRiego').value = p.sistemaRiego || "0.85";
    
    document.getElementById('checkAzolla').checked = p.checkAzolla ?? false;
    document.getElementById('checkAzolla').dispatchEvent(new Event('change'));
    document.getElementById('areaAzolla').value = p.areaAzolla || 10;
    document.getElementById('laminaAzolla').value = p.laminaAzolla || 0.15;
    document.getElementById('fraccionAzolla').value = p.fraccionAzolla || 1;
    document.getElementById('evaporacionAzolla').value = p.evaporacionAzolla || 6;
    document.getElementById('infiltracionAzolla').value = p.infiltracionAzolla || 0;

    document.getElementById('rangoAnios').value = p.rangoAnios || 1;

    actualizarIlustracionFinca();
    ejecutarCalculo();
}

async function eliminarCaso(id, event) {
    event.stopPropagation();
    if (!confirm("¿Desea eliminar este caso guardado?")) return;

    try {
        const response = await fetch(`/api/cases/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (response.status === 401) {
            mostrarPantallaAcceso('La sesión venció. Inicia sesión de nuevo.');
            return;
        }
        if (!response.ok) {
            throw new Error(`No se pudo eliminar el caso (${response.status}).`);
        }

        await cargarCasosServidor();
    } catch (error) {
        console.error('No se pudo eliminar el caso.', error);
        alert(error.message);
    }
}

function renderizarListaCasos() {
    const container = document.getElementById('listaCasosContainer');

    if (casosGuardados.length === 0) {
        container.innerHTML = `<div class="p-3 rounded-xl border border-slate-200 bg-slate-50 text-center text-xs text-slate-400">No hay casos guardados aún.</div>`;
        return;
    }

    container.innerHTML = '';
    casosGuardados.forEach(c => {
        const item = document.createElement('div');
        item.className = "p-2.5 rounded-xl border border-slate-200 bg-white hover:border-emerald-500 cursor-pointer transition-all flex items-center justify-between group shadow-sm";
        item.addEventListener('click', () => cargarCaso(c.id));

        const details = document.createElement('div');
        const name = document.createElement('h4');
        name.className = 'text-xs font-bold text-slate-800 group-hover:text-emerald-700';
        name.textContent = c.nombre;
        const date = document.createElement('span');
        date.className = 'text-[9px] text-slate-400';
        date.textContent = c.fecha;
        details.append(name, date);

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'text-slate-400 hover:text-rose-600 p-1';
        deleteButton.title = 'Eliminar';
        deleteButton.setAttribute('aria-label', `Eliminar caso ${c.nombre}`);
        deleteButton.innerHTML = '<i data-lucide="trash-2" class="w-3.5 h-3.5"></i>';
        deleteButton.addEventListener('click', event => eliminarCaso(c.id, event));

        item.append(details, deleteButton);
        container.appendChild(item);
    });
    lucide.createIcons();
}

function setupTabs() {
    const tablist = document.querySelector('[role="tablist"]');
    const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
    const panels = tabs.map(tab => document.getElementById(tab.getAttribute('aria-controls')));

    function activarPestana(tab, moverFoco = false) {
        tabs.forEach((currentTab, index) => {
            const activa = currentTab === tab;
            currentTab.setAttribute('aria-selected', String(activa));
            currentTab.tabIndex = activa ? 0 : -1;
            currentTab.classList.toggle('bg-emerald-700', activa);
            currentTab.classList.toggle('text-white', activa);
            currentTab.classList.toggle('shadow-md', activa);
            currentTab.classList.toggle('bg-white/70', !activa);
            currentTab.classList.toggle('text-slate-600', !activa);
            currentTab.classList.toggle('hover:bg-white', !activa);
            currentTab.classList.toggle('hover:text-emerald-800', !activa);
            panels[index].hidden = !activa;
        });

        if (moverFoco) tab.focus();
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => activarPestana(tab));
    });

    tablist.addEventListener('keydown', event => {
        const selectedTab = event.target.closest('[role="tab"]');
        const selectedIndex = tabs.indexOf(selectedTab);
        if (selectedIndex < 0) return;

        let nextIndex;
        switch (event.key) {
            case 'ArrowRight':
                nextIndex = (selectedIndex + 1) % tabs.length;
                break;
            case 'ArrowLeft':
                nextIndex = (selectedIndex - 1 + tabs.length) % tabs.length;
                break;
            case 'Home':
                nextIndex = 0;
                break;
            case 'End':
                nextIndex = tabs.length - 1;
                break;
            default:
                return;
        }

        event.preventDefault();
        activarPestana(tabs[nextIndex], true);
    });
}

function setupIlustracionFinca() {
    document.getElementById('material').addEventListener('change', actualizarIlustracionFinca);
    document.getElementById('tipoCultivo').addEventListener('change', actualizarIlustracionFinca);
    document.getElementById('sistemaRiego').addEventListener('change', actualizarIlustracionFinca);
    document.getElementById('capacidadTanque').addEventListener('input', actualizarIlustracionFinca);
    actualizarIlustracionFinca();
}

function actualizarIlustracionFinca() {
    const material = document.getElementById('material');
    const capacidadTanque = document.getElementById('capacidadTanque');
    const cultivo = document.getElementById('tipoCultivo');
    const sistemaRiego = document.getElementById('sistemaRiego');

    const coloresTecho = {
        '0.90': '#94a3b8',
        '0.85': '#bae6fd',
        '0.92': '#64748b'
    };
    const gruposCultivo = {
        maiz: document.getElementById('cultivo-maiz'),
        melon: document.getElementById('cultivo-melon'),
        pasto: document.getElementById('cultivo-pasto'),
        hortalizas: document.getElementById('cultivo-hortalizas')
    };
    const gruposRiego = {
        '0.85': document.getElementById('riego-aspersion'),
        '0.90': document.getElementById('riego-goteo'),
        '0.75': document.getElementById('riego-gravedad')
    };

    const materialLabel = material.options[material.selectedIndex].textContent.trim();
    const cultivoLabel = cultivo.options[cultivo.selectedIndex].textContent.trim();
    const riegoLabel = sistemaRiego.options[sistemaRiego.selectedIndex].textContent.trim();
    const capacidadLabel = capacidadTanque.value ? `${capacidadTanque.value} m³` : 'Sin definir';

    document.getElementById('ilustracionTecho').setAttribute('fill', coloresTecho[material.value]);
    document.getElementById('ilustracionMaterial').textContent = materialLabel;
    document.getElementById('ilustracionCapacidad').textContent = capacidadLabel;
    document.getElementById('ilustracionCultivo').textContent = cultivoLabel;
    document.getElementById('ilustracionRiego').textContent = riegoLabel;
    document.getElementById('ilustracionDescripcion').textContent = `Esquema de referencia: cubierta de ${materialLabel}, recoge el agua por la canaleta hacia un tanque de ${capacidadLabel}, para cultivar ${cultivoLabel} con ${riegoLabel}.`;

    Object.entries(gruposCultivo).forEach(([valor, grupo]) => {
        grupo.style.display = valor === cultivo.value ? 'inline' : 'none';
    });
    Object.entries(gruposRiego).forEach(([valor, grupo]) => {
        grupo.style.display = valor === sistemaRiego.value ? 'inline' : 'none';
    });
}

function setupToggles() {
    const checkAnimales = document.getElementById('checkAnimales');
    const seccionAnimales = document.getElementById('seccionAnimales');
    const lblAnimales = document.getElementById('lblAnimales');

    checkAnimales.addEventListener('change', () => {
        const activo = checkAnimales.checked;
        seccionAnimales.classList.toggle('hidden', !activo);
        lblAnimales.textContent = activo ? "Sí" : "No";
        lblAnimales.className = `ml-2 text-xs font-bold ${activo ? 'text-teal-800' : 'text-slate-400'}`;
    });

    const checkCultivo = document.getElementById('checkCultivo');
    const seccionCultivo = document.getElementById('seccionCultivo');
    const lblCultivo = document.getElementById('lblCultivo');

    checkCultivo.addEventListener('change', () => {
        const activo = checkCultivo.checked;
        seccionCultivo.classList.toggle('hidden', !activo);
        lblCultivo.textContent = activo ? "Sí" : "No";
        lblCultivo.className = `ml-2 text-xs font-bold ${activo ? 'text-teal-800' : 'text-slate-400'}`;
    });

    const checkAzolla = document.getElementById('checkAzolla');
    const seccionAzolla = document.getElementById('seccionAzolla');

    checkAzolla.addEventListener('change', () => {
        seccionAzolla.classList.toggle('hidden', !checkAzolla.checked);
    });
}

function setupModoTecnico() {
    const checkTecnico = document.getElementById('checkModoTecnico');
    const panelGeo = document.getElementById('panelGeometriaTecnica');
    const panelCap = document.getElementById('panelCaptacionTecnica');

    const inputsTecnicos = ['formaReservorio', 'largoFondo', 'anchoFondo', 'profundidadTotal', 'bordeLibre', 'zonaMuerta', 'taludHV', 'intensidadIDF', 'primerLavado'];

    checkTecnico.addEventListener('change', () => {
        const activo = checkTecnico.checked;
        panelGeo.classList.toggle('hidden', !activo);
        panelCap.classList.toggle('hidden', !activo);
        if (activo) recalcularGeometriaEnPantalla();
    });

    inputsTecnicos.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => {
            if (document.getElementById('checkModoTecnico').checked) {
                recalcularGeometriaEnPantalla();
            }
        });
    });
}

function recalcularGeometriaEnPantalla() {
    const geo = {
        forma: document.getElementById('formaReservorio').value,
        largoFondo: parseFloat(document.getElementById('largoFondo').value) || 0,
        anchoFondo: parseFloat(document.getElementById('anchoFondo').value) || 0,
        profundidadTotal: parseFloat(document.getElementById('profundidadTotal').value) || 0,
        bordeLibre: parseFloat(document.getElementById('bordeLibre').value) || 0,
        zonaMuerta: parseFloat(document.getElementById('zonaMuerta').value) || 0,
        taludHV: parseFloat(document.getElementById('taludHV').value) || 1.5
    };

    const resGeo = Calculator.calcularVolumenUtilTecnico(geo);

    document.getElementById('lblVolumenUtilM3').textContent = `${resGeo.volumenUtilM3.toLocaleString()} m³`;
    document.getElementById('lblDetalleVolumen').textContent = `Útil = almacenamiento - zona muerta = ${resGeo.volumenUtilLitros.toLocaleString()} L. Profundidad útil efectiva: ${resGeo.hUtil} m.`;
}

function ejecutarCalculo() {
    const modoTecnico = document.getElementById('checkModoTecnico').checked;

    const params = {
        modoTecnico: modoTecnico,
        canton: document.getElementById('canton').value,
        distrito: document.getElementById('distrito').value,
        escenarioClima: document.getElementById('escenarioClima').value,
        areaTecho: parseFloat(document.getElementById('areaTecho').value) || 0,
        materialCoef: parseFloat(document.getElementById('material').value) || 0.9,
        capacidadTanque: parseFloat(document.getElementById('capacidadTanque').value) || 0,

        intensidadIDF: parseFloat(document.getElementById('intensidadIDF').value) || 100,
        primerLavado: modoTecnico ? (parseFloat(document.getElementById('primerLavado').value) || 0) : 0,

        geometria: {
            forma: document.getElementById('formaReservorio').value,
            largoFondo: parseFloat(document.getElementById('largoFondo').value) || 0,
            anchoFondo: parseFloat(document.getElementById('anchoFondo').value) || 0,
            profundidadTotal: parseFloat(document.getElementById('profundidadTotal').value) || 0,
            bordeLibre: parseFloat(document.getElementById('bordeLibre').value) || 0,
            zonaMuerta: parseFloat(document.getElementById('zonaMuerta').value) || 0,
            taludHV: parseFloat(document.getElementById('taludHV').value) || 1.5
        },

        activoAnimales: document.getElementById('checkAnimales').checked,
        tipoGanado: document.getElementById('tipoGanado').value,
        cabezasBovinos: parseFloat(document.getElementById('cabezasBovinos').value) || 0,
        aguaLimpieza: parseFloat(document.getElementById('aguaLimpieza').value) || 0,

        activoCultivo: document.getElementById('checkCultivo').checked,
        tipoCultivo: document.getElementById('tipoCultivo').value,
        etapaFenologica: document.getElementById('etapaFenologica').value,
        areaCultivo: parseFloat(document.getElementById('areaCultivo').value) || 0,
        sistemaRiego: parseFloat(document.getElementById('sistemaRiego').value) || 0.85,

        azolla: {
            activo: document.getElementById('checkAzolla').checked,
            area: parseFloat(document.getElementById('areaAzolla').value) || 0,
            lamina: parseFloat(document.getElementById('laminaAzolla').value) || 0.15,
            fraccionInicio: parseFloat(document.getElementById('fraccionAzolla').value) || 1,
            evaporacion: parseFloat(document.getElementById('evaporacionAzolla').value) || 6,
            infiltracion: parseFloat(document.getElementById('infiltracionAzolla').value) || 0
        },

        rangoAnios: parseInt(document.getElementById('rangoAnios').value) || 1
    };

    const res = Calculator.calcular(params);

    document.getElementById('resCaptacion').textContent = res.captacionAnual.toLocaleString() + " L";
    document.getElementById('resDemandaDiaria').textContent = res.demandaDiariaTotal.toLocaleString() + " L/día";
    document.getElementById('resConfiabilidad').textContent = res.confiabilidad + "%";
    document.getElementById('resAguaDerramada').textContent = res.aguaDerramadaTotal.toLocaleString() + " L";

    document.getElementById('lblCaudalPico').textContent = res.caudalPicoLs + " L/s";

    document.getElementById('detGanado').textContent = res.demandaGanado.toLocaleString() + " L/día";
    document.getElementById('detCultivo').textContent = res.demandaCultivo.toLocaleString() + " L/día";
    document.getElementById('detAzolla').textContent = res.demandaAzolla.toLocaleString() + " L/día";
    document.getElementById('detAreaMax').textContent = res.areaMaxCultivoM2.toLocaleString() + " m²";
    document.getElementById('detTanque').textContent = res.capacidadTanqueL.toLocaleString() + " Litros";

    const alertBox = document.getElementById('alertBox');
    const alertMessage = document.getElementById('alertMessage');

    if (res.confiabilidad < 70) {
        alertBox.className = "p-3.5 rounded-2xl border bg-rose-50/95 border-rose-300 text-rose-900 shadow-md backdrop-blur-md flex items-center gap-3";
        alertMessage.textContent = "Alerta crítica: La confiabilidad del sistema es baja (" + res.confiabilidad + "%). Riego o bebida en riesgo durante la racha seca.";
    } else if (res.confiabilidad < 90) {
        alertBox.className = "p-3.5 rounded-2xl border bg-amber-50/95 border-amber-300 text-amber-900 shadow-md backdrop-blur-md flex items-center gap-3";
        alertMessage.textContent = "Precaución: Confiabilidad del " + res.confiabilidad + "%. Se sugiere aumentar la captación o el tamaño del reservorio.";
    } else {
        alertBox.className = "p-3.5 rounded-2xl border bg-emerald-50/95 border-emerald-300 text-emerald-900 shadow-md backdrop-blur-md flex items-center gap-3";
        alertMessage.textContent = "Excelente balance: Confiabilidad del " + res.confiabilidad + "% para la finca.";
    }

    const tituloGrafico = document.getElementById('tituloGrafico');
    const nombresEscenario = {
        tipico: 'Año típico',
        seco: 'Año seco',
        humedo: 'Año húmedo'
    };
    const nombreEscenario = nombresEscenario[params.escenarioClima] || 'Escenario seleccionado';
    tituloGrafico.innerHTML = `<i data-lucide="line-chart" class="text-emerald-700"></i> Agua mes a mes · ${res.anios} ${res.anios === 1 ? 'año' : 'años'} · ${nombreEscenario}`;
    lucide.createIcons();

    renderGraficoMultilinea(res);
}

function renderGraficoMultilinea(res) {
    const ctx = document.getElementById('chartBalance').getContext('2d');

    if (chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: res.labels,
            datasets: [
                {
                    label: 'En el tanque al cierre',
                    data: res.nivelTanqueSerie,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.3,
                    pointBackgroundColor: '#10b981',
                    pointStyle: 'circle',
                    pointRadius: 4
                },
                {
                    label: 'Recogida durante el mes',
                    data: res.captacionLluviaSerie,
                    borderColor: '#0284c7',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.2,
                    pointBackgroundColor: '#0284c7',
                    pointStyle: 'rect',
                    pointRadius: 3
                },
                {
                    label: 'Usada durante el mes',
                    data: res.consumoFincaSerie,
                    borderColor: '#f43f5e',
                    borderWidth: 2,
                    borderDash: [2, 3],
                    fill: false,
                    tension: 0.2,
                    pointBackgroundColor: '#f43f5e',
                    pointStyle: 'triangle',
                    pointRadius: 3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        boxWidth: 12,
                        padding: 16,
                        font: { size: 12, weight: 'bold' }
                    }
                },
                tooltip: {
                    callbacks: {
                        title: items => items.length ? `Mes: ${items[0].label}` : '',
                        label: context => `${context.dataset.label}: ${Number(context.parsed.y).toLocaleString('es-CR')} L`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(226, 232, 240, 0.8)' },
                    title: {
                        display: true,
                        text: 'Agua (litros)',
                        font: { size: 12, weight: 'bold' }
                    },
                    ticks: {
                        callback: value => Number(value).toLocaleString('es-CR')
                    }
                },
                x: {
                    grid: { display: false },
                    title: {
                        display: true,
                        text: 'Mes',
                        font: { size: 12, weight: 'bold' }
                    },
                    ticks: {
                        maxTicksLimit: 12,
                        maxRotation: 0,
                        minRotation: 0
                    }
                }
            }
        }
    });
}

async function generarInformePDF() {
    if (!window.jspdf) {
        alert("El módulo de PDF aún se está cargando, reintenta en un momento...");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    const nombreFinca = document.getElementById('nombreFinca')?.value || "Finca";
    const selectCanton = document.getElementById('canton');
    const selectDistrito = document.getElementById('distrito');

    const cantonText = selectCanton.options[selectCanton.selectedIndex]?.text || "N/A";
    const distritoText = selectDistrito.options[selectDistrito.selectedIndex]?.text || "N/A";

    doc.setFillColor(6, 95, 70);
    doc.rect(0, 0, 210, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text("REPORTE TÉCNICO DE BALANCE HÍDRICO (IMN / FAO)", 14, 16);

    doc.setTextColor(40, 40, 40);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Fecha de emisión: ${new Date().toLocaleDateString('es-CR')}`, 14, 33);
    doc.text(`Finca: ${nombreFinca}`, 14, 39);
    doc.text(`Ubicación: Cantón de ${cantonText}, Distrito de ${distritoText}`, 14, 45);

    doc.setFillColor(240, 253, 244);
    doc.roundedRect(14, 52, 182, 22, 3, 3, 'F');
    doc.setTextColor(6, 95, 70);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("CAPTACIÓN ANUAL ESTIMADA:", 18, 60);
    doc.setFontSize(13);
    doc.text(document.getElementById('resCaptacion')?.innerText || "0 L", 18, 68);

    doc.setFontSize(10);
    doc.text("CONFIABILIDAD DEL SISTEMA:", 110, 60);
    doc.setFontSize(13);
    doc.text(document.getElementById('resConfiabilidad')?.innerText || "0%", 110, 68);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Detalle del Balance e Indicadores", 14, 83);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`• Bebida Animal + Limpieza: ${document.getElementById('detGanado')?.innerText || '0 L/día'}`, 18, 91);
    doc.text(`• Riego de Cultivo (Ajuste FAO-56): ${document.getElementById('detCultivo')?.innerText || '0 L/día'}`, 18, 97);
    doc.text(`• Demanda Estanque Azolla: ${document.getElementById('detAzolla')?.innerText || '0 L/día'}`, 18, 103);
    doc.text(`• Área Máxima de Cultivo Abastecible: ${document.getElementById('detAreaMax')?.innerText || '0 m²'}`, 18, 109);
    doc.text(`• Capacidad Total del Tanque: ${document.getElementById('detTanque')?.innerText || '0 Litros'}`, 18, 115);

    const canvas = document.getElementById("chartBalance");
    if (canvas) {
        const img = canvas.toDataURL("image/png");
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("Proyección del Tanque (Balance Mensual)", 14, 126);
        doc.addImage(img, "PNG", 14, 130, 182, 85);
    }

    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text("Generado por Cosecha de Agua Guanacaste - Universidad Nacional de Costa Rica (CEMEDE)", 14, 285);

    doc.save(`Informe_Agua_${nombreFinca}_${cantonText}.pdf`);
}