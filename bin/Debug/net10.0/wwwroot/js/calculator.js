const Calculator = {
    tasasGanado: {
        bovino_leche: 110,
        bovino_carne: 50,
        bovino_toro: 70,
        porcino_engorde: 8,
        equino: 45,
        ovino_caprino: 10,
        avicola_100: 30
    },

    distritosPorCanton: {
        hojancha: ["Hojancha", "Monte Romo", "Puerto Carrillo", "Huacas", "Matambú"],
        nicoya: ["Nicoya", "Mansión", "San Antonio", "Quebrada Honda", "Sámara", "Nosara", "Belén de Nosarita"],
        liberia: ["Liberia", "Cañas Dulces", "Mayorga", "Nacascolo", "Curubandé"],
        santa_cruz: ["Santa Cruz", "Bolsón", "Veintisiete de Abril", "Tempate", "Cartagena", "Cuajiniquil", "Diriá", "Cabo Velas", "Tamarindo"],
        bagaces: ["Bagaces", "La Fortuna", "Mogote", "Río Naranjo"],
        carrillo: ["Filadelfia", "Palmira", "Sardinal", "Belén"],
        canas: ["Cañas", "Palmira", "San Miguel", "Bebedero", "Porozal"],
        abangares: ["Las Juntas", "Sierra", "San Juan", "Colorado"],
        tilaran: ["Tilarán", "Quebrada Grande", "Tronadora", "Santa Rosa", "Líbano", "Tierras Morenas", "Arenal"],
        nandayure: ["Carmona", "Santa Rita", "Zapotal", "San Pablo", "Porvenir", "Bejuco"],
        la_cruz: ["La Cruz", "Santa Cecilia", "La Garita", "Santa Elena"]
    },

    // Factores de corrección climática específicos por distrito basados en estaciones IMN y Zonas de Vida (Holdridge)
   factoresDistritosIMN: {
    // Hojancha
    "hojancha": 1.05, "monte_romo": 1.15, "puerto_carrillo": 0.90, "huacas": 0.95, "matambu": 1.00,
    // Nicoya
    "nicoya": 1.00, "mansion": 1.05, "san_antonio": 0.95, "quebrada_honda": 0.90, "samara": 0.92, "nosara": 1.20, "belen_de_nosarita": 1.05,
    // Liberia
    "liberia": 1.00, "canas_dulces": 1.25, "mayorga": 1.10, "nacascolo": 0.85, "curubande": 1.15,
    // Santa Cruz
    "santa_cruz": 1.00, "bolson": 0.95, "veintisiete_de_abril": 0.92, "tempate": 0.90, "cartagena": 0.95, "cuajiniquil": 0.88, "diria": 1.05, "cabo_velas": 0.85, "tamarindo": 0.85,
    // Bagaces
    "bagaces": 1.00, "la_fortuna": 1.30, "mogote": 0.95, "rio_naranjo": 1.40,
    // Carrillo
    "filadelfia": 1.00, "palmira": 0.98, "sardinal": 0.92, "belen": 0.95,
    // Cañas
    "canas": 1.00, "san_miguel": 1.05, "bebedero": 0.90, "porozal": 0.92,
    // Abangares
    "las_juntas": 1.10, "sierra": 1.15, "san_juan": 1.05, "colorado": 0.95,
    // Tilarán
    "tilaran": 1.35, "quebrada_grande": 1.40, "tronadora": 1.30, "santa_rosa": 1.25, "libano": 1.20, "tierras_morenas": 1.45, "arenal": 1.50,
    // Nandayure
    "carmona": 1.05, "santa_rita": 1.00, "zapotal": 1.15, "san_pablo": 1.05, "porvenir": 1.00, "bejuco": 0.95,
    // La Cruz
    "la_cruz": 0.95, "santa_cecilia": 1.25, "la_garita": 1.00, "santa_elena": 1.10
},

    precipitacionBase: [10, 15, 25, 70, 220, 260, 180, 210, 320, 340, 140, 30],
    diasPorMes: [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
    nombresMeses: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Dic"],

    coordenadasCantones: {
        hojancha: { lat: 9.8311, lon: -85.4144 },
        nicoya: { lat: 10.1444, lon: -85.4526 },
        liberia: { lat: 10.6339, lon: -85.4378 },
        santa_cruz: { lat: 10.2636, lon: -85.5851 },
        bagaces: { lat: 10.5312, lon: -85.2539 },
        carrillo: { lat: 10.4394, lon: -85.5489 },
        canas: { lat: 10.4311, lon: -85.0983 },
        abangares: { lat: 10.2794, lon: -84.9536 },
        tilaran: { lat: 10.4633, lon: -84.9686 },
        nandayure: { lat: 9.9825, lon: -85.3408 },
        la_cruz: { lat: 11.0732, lon: -85.6322 }
    },

    calcularVolumenUtilTecnico: function(p) {
        const hUtil = Math.max(0, p.profundidadTotal - p.bordeLibre - p.zonaMuerta);
        let volM3 = 0;

        if (p.forma === 'rect_vert') {
            volM3 = p.largoFondo * p.anchoFondo * hUtil;
        } else if (p.forma === 'rect_talud') {
            const largoMedio = p.largoFondo + (p.taludHV * hUtil);
            const anchoMedio = p.anchoFondo + (p.taludHV * hUtil);
            volM3 = largoMedio * anchoMedio * hUtil;
        } else {
            const r = p.largoFondo / 2;
            volM3 = Math.PI * Math.pow(r, 2) * hUtil;
        }

        return {
            volumenUtilM3: parseFloat(volM3.toFixed(2)),
            volumenUtilLitros: Math.round(volM3 * 1000),
            hUtil: hUtil.toFixed(2)
        };
    },

    calcularCantonCercano: function(lat, lon) {
        let cantonCercano = "nicoya";
        let distanciaMinima = Infinity;

        for (const [key, coords] of Object.entries(this.coordenadasCantones)) {
            const d = Math.hypot(coords.lat - lat, coords.lon - lon);
            if (d < distanciaMinima) {
                distanciaMinima = d;
                cantonCercano = key;
            }
        }
        return cantonCercano;
    },

    calcular: function(params) {
        let factorClima = 1.0;
        if (params.escenarioClima === 'seco') factorClima = 0.75;
        if (params.escenarioClima === 'humedo') factorClima = 1.20;

        const distKey = params.distrito || "nicoya";
        const factorDistrito = this.factoresDistritosIMN[distKey] || 1.0;

        const perfilLluvia = this.precipitacionBase.map(mm => mm * factorClima * factorDistrito);

        let capacidadTanqueL = params.capacidadTanque * 1000;
        if (params.modoTecnico && params.geometria) {
            const tec = this.calcularVolumenUtilTecnico(params.geometria);
            capacidadTanqueL = tec.volumenUtilLitros;
        }

        const intensidad = params.intensidadIDF || 100;
        const caudalPicoLs = (intensidad * params.areaTecho * params.materialCoef) / 3600;

        let demandaGanado = 0;
        if (params.activoAnimales) {
            const consumoPorAnimal = this.tasasGanado[params.tipoGanado] || 50;
            demandaGanado = (params.cabezasBovinos * consumoPorAnimal) + (params.aguaLimpieza || 0);
        }

        let demandaCultivo = 0;
        if (params.activoCultivo) {
            const kcEtapas = { inicial: 0.40, desarrollo: 0.80, media: 1.15, final: 0.60 };
            const kc = kcEtapas[params.etapaFenologica] || 1.0;
            const efRiego = params.sistemaRiego || 0.85;
            demandaCultivo = (params.areaCultivo * 5 * kc) / efRiego;
        }

        let demandaAzolla = 0;
        if (params.activoAzolla) {
            demandaAzolla = params.areaAzolla * 6;
        }

        const demandaDiariaTotal = demandaGanado + demandaCultivo + demandaAzolla;

        let eficienciaTecho = params.materialCoef;
        if (params.modoTecnico && params.primerLavado > 0) {
            eficienciaTecho = Math.max(0.70, params.materialCoef - 0.05);
        }

        const precipTotalAnual = perfilLluvia.reduce((a, b) => a + b, 0);
        const captacionAnual = params.areaTecho * precipTotalAnual * eficienciaTecho;

        const anios = params.rangoAnios || 1;
        const totalMeses = anios * 12;

        const labels = [];
        const nivelTanqueSerie = [];
        const captacionLluviaSerie = [];
        const consumoFincaSerie = [];

        let nivelTanque = capacidadTanqueL;
        let aguaDerramadaTotal = 0;
        let diasConAgua = 0;
        let totalDiasTotal = 0;

        for (let m = 0; m < totalMeses; m++) {
            const mesIdx = m % 12;
            const mesNombre = this.nombresMeses[mesIdx];
            const numAnio = Math.floor(m / 12) + 1;

            const label = anios === 1 ? mesNombre : `${mesNombre} A${numAnio}`;
            labels.push(label);

            const mm = perfilLluvia[mesIdx];
            const dias = this.diasPorMes[mesIdx];
            totalDiasTotal += dias;

            const captacionMes = params.areaTecho * mm * eficienciaTecho;
            const consumoMes = demandaDiariaTotal * dias;

            let nuevoNivel = nivelTanque + captacionMes - consumoMes;

            if (nuevoNivel > capacidadTanqueL) {
                aguaDerramadaTotal += (nuevoNivel - capacidadTanqueL);
                nuevoNivel = capacidadTanqueL;
            }

            if (nuevoNivel < 0) {
                nuevoNivel = 0;
            } else {
                diasConAgua += dias;
            }

            nivelTanque = nuevoNivel;

            nivelTanqueSerie.push(Math.round(nivelTanque));
            captacionLluviaSerie.push(Math.round(captacionMes));
            consumoFincaSerie.push(Math.round(consumoMes));
        }

        const confiabilidad = Math.min(100, Math.round((diasConAgua / totalDiasTotal) * 100));
        const aguaDisponibleDiariaRiego = Math.max(0, (captacionAnual / 365) - demandaGanado - demandaAzolla);
        const areaMaxCultivoM2 = Math.round((aguaDisponibleDiariaRiego * 0.85) / (5 * 1.0));

        return {
            demandaGanado: Math.round(demandaGanado),
            demandaCultivo: Math.round(demandaCultivo),
            demandaAzolla: Math.round(demandaAzolla),
            demandaDiariaTotal: Math.round(demandaDiariaTotal),
            captacionAnual: Math.round(captacionAnual),
            capacidadTanqueL: capacidadTanqueL,
            caudalPicoLs: caudalPicoLs.toFixed(2),
            aguaDerramadaTotal: Math.round(aguaDerramadaTotal),
            confiabilidad: confiabilidad,
            areaMaxCultivoM2: Math.max(0, areaMaxCultivoM2),
            labels: labels,
            nivelTanqueSerie: nivelTanqueSerie,
            captacionLluviaSerie: captacionLluviaSerie,
            consumoFincaSerie: consumoFincaSerie,
            anios: anios
        };
    }
};