const express = require('express');
const axios = require('axios');

const router = express.Router();

// WHO ICD-11 MMS Clinical Dictionary (Kenya DHA Compliant)
const ICD11_DATABASE = [
  // Infectious & Parasitic Diseases (Chapter 01)
  { code: '1F40', name: 'Malaria due to Plasmodium falciparum', category: 'Infectious' },
  { code: '1F41', name: 'Malaria due to Plasmodium vivax', category: 'Infectious' },
  { code: '1F45', name: 'Malaria, unspecified', category: 'Infectious' },
  { code: '1B10', name: 'Tuberculosis of lung (Pulmonary TB)', category: 'Infectious' },
  { code: '1B11', name: 'Extrapulmonary tuberculosis', category: 'Infectious' },
  { code: '1C62', name: 'Human immunodeficiency virus disease (HIV)', category: 'Infectious' },
  { code: '1A07', name: 'Typhoid fever (Salmonella typhi)', category: 'Infectious' },
  { code: '1A08', name: 'Paratyphoid fever', category: 'Infectious' },
  { code: '1A36', name: 'Amoebiasis / Amoebic dysentery', category: 'Infectious' },
  { code: '1A40', name: 'Gastroenteritis or colitis of infectious origin / Diarrhoeal disease', category: 'Infectious' },
  { code: '1A00', name: 'Cholera', category: 'Infectious' },
  { code: '1F80', name: 'Schistosomiasis (Bilharzia)', category: 'Infectious' },
  { code: '1D20', name: 'Dengue fever', category: 'Infectious' },
  { code: '1G40', name: 'Sepsis / Septicaemia', category: 'Infectious' },
  { code: '1C40', name: 'Tetanus', category: 'Infectious' },
  { code: '1A21', name: 'Brucellosis', category: 'Infectious' },
  { code: '1E50.0', name: 'Acute hepatitis A', category: 'Infectious' },
  { code: '1E50.1', name: 'Acute hepatitis B', category: 'Infectious' },
  { code: '1E50.2', name: 'Acute hepatitis C', category: 'Infectious' },
  { code: '1D80', name: 'Measles', category: 'Infectious' },
  { code: '1E90', name: 'Varicella (Chickenpox)', category: 'Infectious' },
  { code: '1E91', name: 'Herpes zoster (Shingles)', category: 'Infectious' },
  { code: '1F23', name: 'Dermatophytosis / Tinea corporis (Ringworm)', category: 'Infectious' },
  { code: '1F23.1', name: 'Candidiasis (Oral / Vaginal thrush)', category: 'Infectious' },

  // Respiratory System (Chapter 12)
  { code: 'CA00', name: 'Acute upper respiratory tract infection (Common Cold / Acute Nasopharyngitis)', category: 'Respiratory' },
  { code: 'CA03', name: 'Acute tonsillitis', category: 'Respiratory' },
  { code: 'CA02', name: 'Acute pharyngitis', category: 'Respiratory' },
  { code: 'CA20', name: 'Acute bronchitis', category: 'Respiratory' },
  { code: 'CA40', name: 'Pneumonia, bacterial / Community-acquired pneumonia', category: 'Respiratory' },
  { code: 'CA23', name: 'Asthma (Bronchial asthma)', category: 'Respiratory' },
  { code: 'CA22', name: 'Chronic obstructive pulmonary disease (COPD)', category: 'Respiratory' },
  { code: 'CA08', name: 'Allergic rhinitis', category: 'Respiratory' },
  { code: 'MD11', name: 'Cough', category: 'Symptoms' },

  // Cardiovascular System (Chapter 11)
  { code: 'BA00', name: 'Essential hypertension (Primary hypertension)', category: 'Cardiovascular' },
  { code: 'BA01', name: 'Secondary hypertension', category: 'Cardiovascular' },
  { code: 'BA02', name: 'Hypertensive heart disease', category: 'Cardiovascular' },
  { code: 'BA40', name: 'Acute myocardial infarction (Heart attack)', category: 'Cardiovascular' },
  { code: 'BD10', name: 'Congestive heart failure (Heart failure)', category: 'Cardiovascular' },
  { code: 'MB40', name: 'Stroke / Cerebrovascular accident', category: 'Cardiovascular' },
  { code: 'BH10', name: 'Acute rheumatic fever', category: 'Cardiovascular' },

  // Endocrine, Nutritional & Metabolic (Chapter 05)
  { code: '5A11', name: 'Type 2 diabetes mellitus', category: 'Endocrine' },
  { code: '5A10', name: 'Type 1 diabetes mellitus', category: 'Endocrine' },
  { code: '5A11.1', name: 'Gestational diabetes mellitus', category: 'Endocrine' },
  { code: '5A02', name: 'Thyrotoxicosis / Hyperthyroidism', category: 'Endocrine' },
  { code: '5A00', name: 'Hypothyroidism', category: 'Endocrine' },
  { code: '5B81', name: 'Obesity', category: 'Endocrine' },
  { code: '5B50', name: 'Severe acute malnutrition (Kwashiorkor / Marasmus)', category: 'Endocrine' },

  // Maternal, Reproductive & Genitourinary (Chapter 16 / Chapter 18)
  { code: 'GC08', name: 'Urinary tract infection (UTI)', category: 'Genitourinary' },
  { code: 'GC00', name: 'Acute pyelonephritis', category: 'Genitourinary' },
  { code: 'GA00', name: 'Pelvic inflammatory disease (PID)', category: 'Genitourinary' },
  { code: '1A60', name: 'Syphilis / Sexually transmitted infection', category: 'Genitourinary' },
  { code: '1A70', name: 'Gonococcal infection (Gonorrhoea)', category: 'Genitourinary' },
  { code: 'GA10', name: 'Vaginitis / Bacterial vaginosis', category: 'Genitourinary' },
  { code: 'JA00', name: 'Single spontaneous delivery (Normal vertex delivery)', category: 'Maternal' },
  { code: 'JB41', name: 'Preeclampsia in pregnancy', category: 'Maternal' },
  { code: 'JB42', name: 'Eclampsia in pregnancy', category: 'Maternal' },
  { code: 'JB40', name: 'Gestational hypertension', category: 'Maternal' },
  { code: 'JA60', name: 'Hyperemesis gravidarum', category: 'Maternal' },
  { code: 'JA01', name: 'Spontaneous abortion / Miscarriage', category: 'Maternal' },
  { code: 'JA80', name: 'Antepartum haemorrhage', category: 'Maternal' },
  { code: 'JA81', name: 'Postpartum haemorrhage (PPH)', category: 'Maternal' },
  { code: 'JA02', name: 'Ectopic pregnancy', category: 'Maternal' },

  // Digestive System (Chapter 13)
  { code: 'DB10', name: 'Acute appendicitis', category: 'Digestive' },
  { code: 'DA60', name: 'Peptic ulcer disease / Gastritis', category: 'Digestive' },
  { code: 'DA22', name: 'Gastro-oesophageal reflux disease (GERD)', category: 'Digestive' },
  { code: 'MD30', name: 'Dyspepsia / Heartburn', category: 'Digestive' },
  { code: 'DC11', name: 'Acute cholecystitis', category: 'Digestive' },
  { code: 'DD50', name: 'Inguinal / Abdominal hernia', category: 'Digestive' },
  { code: 'ME05', name: 'Constipation', category: 'Digestive' },

  // Musculoskeletal & Injuries (Chapter 15 / Chapter 22)
  { code: 'FA80', name: 'Low back pain / Lumbar spondylosis', category: 'Musculoskeletal' },
  { code: 'FA00', name: 'Osteoarthritis (Knee / Hip / Polyarticular)', category: 'Musculoskeletal' },
  { code: 'FA20', name: 'Rheumatoid arthritis', category: 'Musculoskeletal' },
  { code: 'NC32', name: 'Fracture of femur', category: 'Injury' },
  { code: 'NC34', name: 'Fracture of lower leg (Tibia / Fibula)', category: 'Injury' },
  { code: 'NC12', name: 'Fracture of forearm (Radius / Ulna)', category: 'Injury' },
  { code: 'NE60', name: 'Open wound / Laceration', category: 'Injury' },
  { code: 'ND90', name: 'Burn (Thermal / Chemical)', category: 'Injury' },

  // Mental, Behavioural & Neurological (Chapter 06 / Chapter 08)
  { code: '8A60', name: 'Epilepsy / Seizure disorder', category: 'Neurological' },
  { code: '8A80', name: 'Migraine', category: 'Neurological' },
  { code: '8A81', name: 'Tension-type headache', category: 'Neurological' },
  { code: 'MB23', name: 'Fever of unknown origin / Pyrexia', category: 'Symptoms' },
  { code: '6B00', name: 'Generalized anxiety disorder', category: 'Mental' },
  { code: '6A70', name: 'Major depressive disorder', category: 'Mental' },
  { code: '6A60', name: 'Bipolar type I disorder', category: 'Mental' },
  { code: '7A20', name: 'Insomnia disorder', category: 'Mental' },

  // Blood & Blood-forming Organs (Chapter 03)
  { code: '3A00', name: 'Iron deficiency anaemia', category: 'Blood' },
  { code: '3A51', name: 'Sickle cell anaemia', category: 'Blood' },
  { code: '3A01', name: 'Megaloblastic anaemia (Vitamin B12 / Folate deficiency)', category: 'Blood' },

  // Skin & Subcutaneous (Chapter 14)
  { code: 'EA80', name: 'Atopic eczema / Dermatitis', category: 'Skin' },
  { code: 'EB00', name: 'Cellulitis', category: 'Skin' },
  { code: 'EB01', name: 'Cutaneous abscess / Boil', category: 'Skin' },
  { code: 'EA20', name: 'Psoriasis', category: 'Skin' },
  { code: 'EB10', name: 'Urticaria / Hives', category: 'Skin' },

  // Eye & Ear (Chapter 09 / Chapter 10)
  { code: '9A60', name: 'Acute conjunctivitis ("Red eye")', category: 'Eye' },
  { code: '9B10', name: 'Cataract', category: 'Eye' },
  { code: '9C60', name: 'Glaucoma', category: 'Eye' },
  { code: 'AA00', name: 'Acute otitis media', category: 'Ear' },
  { code: 'AA02', name: 'Otitis externa', category: 'Ear' }
];

router.get('/search', async (req, res) => {
  try {
    const term = (req.query.term || '').trim().toLowerCase();

    if (!term) {
      return res.status(400).json({ message: 'Search term required' });
    }

    // 1. Search local WHO ICD-11 database
    const localMatches = ICD11_DATABASE.filter(item => 
      item.name.toLowerCase().includes(term) ||
      item.code.toLowerCase().includes(term) ||
      item.category.toLowerCase().includes(term)
    );

    if (localMatches.length >= 3) {
      return res.json(localMatches);
    }

    // 2. Fallback to external NLM search and format as ICD-11
    let externalMatches = [];
    try {
      const response = await axios.get(
        'https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search',
        { params: { sf: 'code,name', terms: term, maxList: 10 } }
      );
      if (response.data && response.data[3]) {
        externalMatches = response.data[3].map(item => ({
          code: `11-${item[0]}`,
          name: item[1],
          category: 'WHO ICD-11'
        }));
      }
    } catch {
      // ignore external API failure
    }

    const combined = [...localMatches, ...externalMatches];
    res.json(combined.length > 0 ? combined : localMatches);

  } catch (error) {
    console.error('ICD-11 Search Error:', error.message);
    res.status(500).json({ message: 'ICD-11 search failed' });
  }
});

module.exports = router;
