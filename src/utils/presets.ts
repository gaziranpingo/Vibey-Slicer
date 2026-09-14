import { PrinterProfile, MaterialProfile, SlicerSettings } from '../types';

export interface PrinterCompany {
  companyId: 'creality' | 'prusa' | 'bambulab' | 'voron' | 'other';
  companyName: string;
  printers: PrinterProfile[];
}

export const PRINTER_COMPANIES: PrinterCompany[] = [
  {
    companyId: 'creality',
    companyName: 'Creality',
    printers: [
      {
        id: 'creality-ender-3',
        name: 'Ender 3 / Pro (220×220)',
        bedWidth: 220,
        bedDepth: 220,
        maxHeight: 250,
        nozzleDiameter: 0.4,
        shape: 'rectangular',
        company: 'Creality'
      },
      {
        id: 'creality-ender-3-v2',
        name: 'Ender 3 V2 / V2 Neo (220×220)',
        bedWidth: 220,
        bedDepth: 220,
        maxHeight: 250,
        nozzleDiameter: 0.4,
        shape: 'rectangular',
        company: 'Creality'
      },
      {
        id: 'creality-ender-3-s1',
        name: 'Ender 3 S1 / S1 Pro (220×220)',
        bedWidth: 220,
        bedDepth: 220,
        maxHeight: 270,
        nozzleDiameter: 0.4,
        shape: 'rectangular',
        company: 'Creality'
      },
      {
        id: 'creality-ender-3-v3-se',
        name: 'Ender 3 V3 SE / KE (220×220)',
        bedWidth: 220,
        bedDepth: 220,
        maxHeight: 250,
        nozzleDiameter: 0.4,
        shape: 'rectangular',
        company: 'Creality'
      },
      {
        id: 'creality-ender-5-plus',
        name: 'Ender 5 Plus (350×350)',
        bedWidth: 350,
        bedDepth: 350,
        maxHeight: 400,
        nozzleDiameter: 0.4,
        shape: 'rectangular',
        company: 'Creality'
      },
      {
        id: 'creality-cr-10',
        name: 'CR-10 / V3 (300×300)',
        bedWidth: 300,
        bedDepth: 300,
        maxHeight: 400,
        nozzleDiameter: 0.4,
        shape: 'rectangular',
        company: 'Creality'
      },
      {
        id: 'creality-k1',
        name: 'K1 / K1C High-Speed (220×220)',
        bedWidth: 220,
        bedDepth: 220,
        maxHeight: 250,
        nozzleDiameter: 0.4,
        shape: 'rectangular',
        company: 'Creality'
      },
      {
        id: 'creality-k1-max',
        name: 'K1 Max Enclosed (300×300)',
        bedWidth: 300,
        bedDepth: 300,
        maxHeight: 300,
        nozzleDiameter: 0.4,
        shape: 'rectangular',
        company: 'Creality'
      },
      {
        id: 'creality-halot-mage',
        name: 'HALOT-MAGE PRO (Resin)',
        bedWidth: 228,
        bedDepth: 128,
        maxHeight: 230,
        nozzleDiameter: 0.0,
        shape: 'rectangular',
        company: 'Creality'
      }
    ]
  },
  {
    companyId: 'prusa',
    companyName: 'Prusa Research',
    printers: [
      {
        id: 'prusa-i3-mk3s',
        name: 'Original Prusa i3 MK3S+ (250×210)',
        bedWidth: 250,
        bedDepth: 210,
        maxHeight: 210,
        nozzleDiameter: 0.4,
        shape: 'rectangular',
        company: 'Prusa'
      },
      {
        id: 'prusa-mk4',
        name: 'Original Prusa MK4 (250×210)',
        bedWidth: 250,
        bedDepth: 210,
        maxHeight: 220,
        nozzleDiameter: 0.4,
        shape: 'rectangular',
        company: 'Prusa'
      },
      {
        id: 'prusa-mk4s',
        name: 'Original Prusa MK4S (250×210)',
        bedWidth: 250,
        bedDepth: 210,
        maxHeight: 220,
        nozzleDiameter: 0.4,
        shape: 'rectangular',
        company: 'Prusa'
      },
      {
        id: 'prusa-mini',
        name: 'Original Prusa MINI+ (180×180)',
        bedWidth: 180,
        bedDepth: 180,
        maxHeight: 180,
        nozzleDiameter: 0.4,
        shape: 'rectangular',
        company: 'Prusa'
      },
      {
        id: 'prusa-xl',
        name: 'Original Prusa XL Multi-Tool (360×360)',
        bedWidth: 360,
        bedDepth: 360,
        maxHeight: 360,
        nozzleDiameter: 0.4,
        shape: 'rectangular',
        company: 'Prusa'
      },
      {
        id: 'prusa-sl1s',
        name: 'Original Prusa SL1S SPEED (Resin)',
        bedWidth: 127,
        bedDepth: 80,
        maxHeight: 150,
        nozzleDiameter: 0.0,
        shape: 'rectangular',
        company: 'Prusa'
      }
    ]
  },
  {
    companyId: 'bambulab',
    companyName: 'Bambu Lab',
    printers: [
      {
        id: 'bambu-x1-carbon',
        name: 'X1-Carbon / X1E (256×256)',
        bedWidth: 256,
        bedDepth: 256,
        maxHeight: 256,
        nozzleDiameter: 0.4,
        shape: 'rectangular',
        company: 'Bambu Lab'
      },
      {
        id: 'bambu-p1p',
        name: 'Bambu Lab P1P (256×256)',
        bedWidth: 256,
        bedDepth: 256,
        maxHeight: 256,
        nozzleDiameter: 0.4,
        shape: 'rectangular',
        company: 'Bambu Lab'
      },
      {
        id: 'bambu-p1s',
        name: 'Bambu Lab P1S Enclosed (256×256)',
        bedWidth: 256,
        bedDepth: 256,
        maxHeight: 256,
        nozzleDiameter: 0.4,
        shape: 'rectangular',
        company: 'Bambu Lab'
      },
      {
        id: 'bambu-a1-mini',
        name: 'Bambu Lab A1 mini (180×180)',
        bedWidth: 180,
        bedDepth: 180,
        maxHeight: 180,
        nozzleDiameter: 0.4,
        shape: 'rectangular',
        company: 'Bambu Lab'
      },
      {
        id: 'bambu-a1',
        name: 'Bambu Lab A1 Bed Slinger (256×256)',
        bedWidth: 256,
        bedDepth: 256,
        maxHeight: 256,
        nozzleDiameter: 0.4,
        shape: 'rectangular',
        company: 'Bambu Lab'
      }
    ]
  },
  {
    companyId: 'voron',
    companyName: 'Voron Design',
    printers: [
      {
        id: 'voron-v0-2',
        name: 'Voron V0.2 CoreXY (120×120)',
        bedWidth: 120,
        bedDepth: 120,
        maxHeight: 120,
        nozzleDiameter: 0.4,
        shape: 'rectangular',
        company: 'Voron'
      },
      {
        id: 'voron-v2-300',
        name: 'Voron 2.4 R2 300×300',
        bedWidth: 300,
        bedDepth: 300,
        maxHeight: 300,
        nozzleDiameter: 0.4,
        shape: 'rectangular',
        company: 'Voron'
      },
      {
        id: 'voron-trident',
        name: 'Voron Trident 350×350',
        bedWidth: 350,
        bedDepth: 350,
        maxHeight: 350,
        nozzleDiameter: 0.4,
        shape: 'rectangular',
        company: 'Voron'
      }
    ]
  }
];

export const PRINTER_PROFILES: PrinterProfile[] = PRINTER_COMPANIES.flatMap(c => c.printers);

export const MATERIAL_PROFILES: MaterialProfile[] = [
  {
    id: 'pla',
    name: 'Generic PLA',
    type: 'PLA',
    hotendTemp: 205,
    bedTemp: 60,
    fanSpeed: 100,
    densityGPerCm3: 1.24,
    costPerKg: 20.0,
    retractionLength: 2.0,
    retractionSpeed: 40
  },
  {
    id: 'petg',
    name: 'Generic PETG',
    type: 'PETG',
    hotendTemp: 235,
    bedTemp: 75,
    fanSpeed: 50,
    densityGPerCm3: 1.27,
    costPerKg: 22.0,
    retractionLength: 2.5,
    retractionSpeed: 35
  },
  {
    id: 'abs',
    name: 'Generic ABS / ASA',
    type: 'ABS',
    hotendTemp: 245,
    bedTemp: 100,
    fanSpeed: 15,
    densityGPerCm3: 1.04,
    costPerKg: 24.0,
    retractionLength: 1.8,
    retractionSpeed: 40
  },
  {
    id: 'tpu',
    name: 'Generic TPU (95A Flexible)',
    type: 'TPU',
    hotendTemp: 220,
    bedTemp: 50,
    fanSpeed: 60,
    densityGPerCm3: 1.21,
    costPerKg: 30.0,
    retractionLength: 0.8,
    retractionSpeed: 25
  }
];

export const DEFAULT_SETTINGS: SlicerSettings = {
  printerId: 'bambu-x1-carbon',
  materialId: 'pla',
  nozzleDiameter: 0.4,
  filamentDiameter: 1.75,
  extrusionMultiplier: 1.0,
  bedTemp: 60,
  hotendTemp: 205,
  fanSpeed: 100,

  layerHeight: 0.2,
  firstLayerHeight: 0.25,

  wallCount: 2,
  wallGapDistance: 0.4,
  topSolidLayers: 3,
  bottomSolidLayers: 3,
  solidInfillPattern: 'monotonic',

  infillDensity: 20,
  infillPattern: 'grid',

  perimeterSpeed: 45,
  infillSpeed: 60,
  travelSpeed: 150,
  firstLayerSpeed: 20,

  retractionLength: 2.0,
  retractionSpeed: 40,
  zHop: 0.2,

  adhesionType: 'skirt',
  skirtOffset: 4.0,
  skirtLoops: 2,
  brimWidth: 5.0,

  enableSupports: true,
  supportStyle: 'regular',
  supportOverhangAngle: 50,
  supportDensity: 18,
  supportZDistance: 0.2,
  supportXyDistance: 0.6
};
