// Seeds service_price_defaults with Kenya standard market prices.
// Global — not tied to any pharmacy. Every facility gets these as defaults.
// Run: node backend/scripts/seed_kenya_prices.js
// Safe to re-run — uses INSERT ... ON CONFLICT DO NOTHING

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const { pool } = require("../config/db");

const PRICES = [
  // LAB TESTS
  ["FBC","Full Blood Count (FBC)","laboratory",350],
  ["HB","Haemoglobin (Hb)","laboratory",150],
  ["PCV","Packed Cell Volume (PCV/HCT)","laboratory",150],
  ["WBC","White Blood Cell Count (WBC)","laboratory",200],
  ["PLT","Platelet Count","laboratory",200],
  ["DC","Differential Count (DC)","laboratory",200],
  ["ESR","Erythrocyte Sedimentation Rate (ESR)","laboratory",200],
  ["BT","Bleeding Time (BT)","laboratory",150],
  ["CT","Clotting Time (CT)","laboratory",150],
  ["PT","Prothrombin Time (PT/INR)","laboratory",400],
  ["APTT","APTT","laboratory",400],
  ["BLOOD-GROUP","Blood Group and Rhesus Factor","laboratory",300],
  ["CROSS-MATCH","Cross Match","laboratory",500],
  ["SICKLING","Sickling Test","laboratory",300],
  ["RETICS","Reticulocyte Count","laboratory",300],
  ["PERIPHERAL-SMEAR","Peripheral Blood Smear","laboratory",350],
  ["BS-MPS","Blood Slide for Malaria Parasites (BS for MPS)","laboratory",300],
  ["MALARIA-RDT","Malaria RDT","laboratory",350],
  ["MALARIA-AG","Malaria Antigen Test","laboratory",400],
  ["THICK-FILM","Thick Blood Film for Malaria","laboratory",300],
  ["THIN-FILM","Thin Blood Film for Malaria","laboratory",300],
  ["RFT","Renal Function Tests (RFTs)","laboratory",800],
  ["UEC","Urea, Electrolytes and Creatinine (UECs)","laboratory",900],
  ["UREA","Blood Urea","laboratory",300],
  ["CREATININE","Serum Creatinine","laboratory",300],
  ["URIC-ACID","Serum Uric Acid","laboratory",350],
  ["GFR","eGFR (Estimated Glomerular Filtration Rate)","laboratory",300],
  ["SODIUM","Serum Sodium (Na+)","laboratory",250],
  ["POTASSIUM","Serum Potassium (K+)","laboratory",250],
  ["CHLORIDE","Serum Chloride (Cl-)","laboratory",250],
  ["BICARBONATE","Serum Bicarbonate (HCO3-)","laboratory",250],
  ["ELECTROLYTES","Serum Electrolytes (Na/K/Cl/HCO3)","laboratory",800],
  ["CALCIUM","Serum Calcium","laboratory",350],
  ["PHOSPHATE","Serum Phosphate","laboratory",350],
  ["MAGNESIUM","Serum Magnesium","laboratory",350],
  ["LFT","Liver Function Tests (LFTs)","laboratory",1200],
  ["TOTAL-PROTEIN","Total Protein","laboratory",300],
  ["ALBUMIN","Serum Albumin","laboratory",300],
  ["TOTAL-BILI","Total Bilirubin","laboratory",300],
  ["DIRECT-BILI","Direct Bilirubin (Conjugated)","laboratory",300],
  ["INDIRECT-BILI","Indirect Bilirubin (Unconjugated)","laboratory",300],
  ["ALT","ALT/SGPT","laboratory",300],
  ["AST","AST/SGOT","laboratory",300],
  ["ALP","Alkaline Phosphatase (ALP)","laboratory",300],
  ["GGT","Gamma GT (GGT)","laboratory",350],
  ["RBS","Random Blood Sugar (RBS)","laboratory",150],
  ["FBS","Fasting Blood Sugar (FBS)","laboratory",150],
  ["2HR-PP","2 Hour Post Prandial Blood Sugar","laboratory",150],
  ["HBA1C","HbA1c (Glycated Haemoglobin)","laboratory",800],
  ["OGTT","Oral Glucose Tolerance Test (OGTT)","laboratory",500],
  ["LIPID-PROFILE","Lipid Profile (Full)","laboratory",1200],
  ["CHOL","Total Cholesterol","laboratory",300],
  ["TRIG","Triglycerides","laboratory",350],
  ["HDL","HDL Cholesterol (Good Cholesterol)","laboratory",350],
  ["LDL","LDL Cholesterol (Bad Cholesterol)","laboratory",350],
  ["TFT","Thyroid Function Tests (TFTs)","laboratory",2500],
  ["TSH","TSH (Thyroid Stimulating Hormone)","laboratory",800],
  ["FT3","Free T3 (Tri-iodothyronine)","laboratory",900],
  ["FT4","Free T4 (Thyroxine)","laboratory",900],
  ["AMYLASE","Serum Amylase","laboratory",500],
  ["LIPASE","Serum Lipase","laboratory",500],
  ["CRP","C-Reactive Protein (CRP)","laboratory",600],
  ["PROCALCITONIN","Procalcitonin (PCT)","laboratory",2500],
  ["ASO","ASO Titre","laboratory",600],
  ["RF","Rheumatoid Factor (RF)","laboratory",600],
  ["PSA","PSA (Prostate Specific Antigen)","laboratory",1500],
  ["CEA","CEA (Carcinoembryonic Antigen)","laboratory",2000],
  ["AFP","AFP (Alpha Fetoprotein)","laboratory",2000],
  ["CA-125","CA-125 (Ovarian Tumour Marker)","laboratory",2500],
  ["IRON","Serum Iron","laboratory",500],
  ["TIBC","TIBC (Total Iron Binding Capacity)","laboratory",600],
  ["FERRITIN","Serum Ferritin","laboratory",800],
  ["FOLATE","Serum Folate","laboratory",800],
  ["VIT-B12","Vitamin B12","laboratory",800],
  ["VIT-D","Vitamin D (25-OH)","laboratory",1500],
  ["URINE-RE","Urine Routine Examination (Urinalysis)","laboratory",300],
  ["URINE-CS","Urine Culture and Sensitivity (C&S)","laboratory",800],
  ["STOOL-RE","Stool Routine Examination","laboratory",300],
  ["STOOL-OAP","Stool for Ova and Parasites (O&P)","laboratory",400],
  ["STOOL-CS","Stool Culture and Sensitivity","laboratory",800],
  ["STOOL-OCCULT","Stool for Occult Blood","laboratory",350],
  ["HVS-CS","High Vaginal Swab (HVS) C&S","laboratory",800],
  ["URETHRAL-CS","Urethral Swab C&S","laboratory",800],
  ["WOUND-CS","Wound Swab C&S","laboratory",800],
  ["THROAT-CS","Throat Swab C&S","laboratory",600],
  ["EAR-CS","Ear Swab C&S","laboratory",600],
  ["SPUTUM-CS","Sputum Culture and Sensitivity","laboratory",800],
  ["SPUTUM-AFB","Sputum for AFB (ZN Stain)","laboratory",400],
  ["GENEXPERT","GeneXpert MTB/RIF (TB)","laboratory",1500],
  ["BLOOD-CS","Blood Culture and Sensitivity","laboratory",1500],
  ["CSF-CS","CSF Culture and Sensitivity","laboratory",1200],
  ["CSF-RE","CSF Routine Examination","laboratory",600],
  ["WIDAL","Widal Test","laboratory",500],
  ["BRUCELLA","Brucella Agglutination Test","laboratory",600],
  ["HIV-RDT","HIV Test (RDT)","laboratory",300],
  ["HIV-ELISA","HIV ELISA","laboratory",800],
  ["VDRL","VDRL (Syphilis)","laboratory",400],
  ["TPHA","TPHA (Syphilis)","laboratory",500],
  ["RPR","RPR (Syphilis)","laboratory",400],
  ["HBSAG","Hepatitis B Surface Antigen (HBsAg)","laboratory",600],
  ["HBEAG","Hepatitis B e Antigen (HBeAg)","laboratory",1200],
  ["ANTI-HBS","Anti-HBs (Hepatitis B Antibody)","laboratory",1000],
  ["HBV-DNA","HBV DNA (Viral Load)","laboratory",5000],
  ["HCV","Hepatitis C Antibody (Anti-HCV)","laboratory",800],
  ["HCV-RNA","HCV RNA (Viral Load)","laboratory",5000],
  ["H-PYLORI-RDT","H. pylori RDT (Stool Antigen)","laboratory",600],
  ["H-PYLORI-AB","H. pylori Antibody (IgG)","laboratory",800],
  ["TORCH","TORCH Screen","laboratory",4000],
  ["DENGUE-RDT","Dengue RDT (NS1/IgG/IgM)","laboratory",1000],
  ["TYPHOID-RDT","Typhoid RDT (Widal)","laboratory",500],
  ["BHCG","Beta HCG (Pregnancy Test - Quantitative)","laboratory",800],
  ["URINE-PREG","Urine Pregnancy Test (UPT)","laboratory",200],
  ["FSH","FSH (Follicle Stimulating Hormone)","laboratory",1200],
  ["LH","LH (Luteinizing Hormone)","laboratory",1200],
  ["PROLACTIN","Prolactin","laboratory",1200],
  ["TESTOSTERONE","Testosterone (Total)","laboratory",1500],
  ["PROGESTERONE","Progesterone","laboratory",1200],
  ["CORTISOL","Cortisol (AM)","laboratory",1500],
  ["AMH","AMH (Anti-Mullerian Hormone)","laboratory",3500],
  ["CD4","CD4 Count","laboratory",1500],
  ["CD4-PCT","CD4 Percentage","laboratory",1500],
  ["VL","HIV Viral Load","laboratory",5000],
  ["DBS","Dried Blood Spot (DBS) - EID","laboratory",1000],
  ["TROPONIN-I","Troponin I","laboratory",2500],
  ["TROPONIN-T","Troponin T","laboratory",2500],
  ["CK-MB","CK-MB (Creatine Kinase MB)","laboratory",1500],
  ["D-DIMER","D-Dimer","laboratory",2000],
  ["BNP","BNP (Brain Natriuretic Peptide)","laboratory",3000],
  ["PAP-SMEAR","Pap Smear (Cervical Cytology)","laboratory",1500],
  ["FNAC","FNAC (Fine Needle Aspiration Cytology)","laboratory",2500],
  ["BIOPSY","Tissue Biopsy (Histology)","laboratory",3500],
  // PROCEDURES
  ["PROC-WD-S","Wound Dressing - Simple","procedure",300],
  ["PROC-WD-C","Wound Dressing - Complex","procedure",600],
  ["PROC-WS-S","Wound Suturing - Simple (< 5 stitches)","procedure",800],
  ["PROC-WS-M","Wound Suturing - Medium (5-10 stitches)","procedure",1500],
  ["PROC-WS-D","Wound Suturing - Deep/Layered","procedure",2500],
  ["PROC-WDB","Wound Debridement","procedure",1500],
  ["PROC-WI","Wound Irrigation","procedure",500],
  ["PROC-BURN-S","Burn Wound Dressing - Minor","procedure",800],
  ["PROC-BURN-M","Burn Wound Dressing - Major","procedure",2000],
  ["PROC-STITCH","Stitch/Suture Removal","procedure",300],
  ["PROC-BACKSLAB","Backslab Application (POP)","procedure",1500],
  ["PROC-IVC","IV Cannulation","procedure",400],
  ["PROC-IVF","IV Fluid Administration","procedure",300],
  ["PROC-IM","IM Injection","procedure",200],
  ["PROC-SC","SC Injection","procedure",200],
  ["PROC-IV-AB","IV Antibiotics Administration","procedure",400],
  ["PROC-BLOOD-TX","Blood Transfusion","procedure",3000],
  ["PROC-CATH-M","Urinary Catheterization - Male","procedure",800],
  ["PROC-CATH-F","Urinary Catheterization - Female","procedure",600],
  ["PROC-CATH-R","Catheter Removal","procedure",300],
  ["PROC-BLADDER","Bladder Wash/Irrigation","procedure",600],
  ["PROC-O2-MASK","Oxygen Therapy - Face Mask","procedure",500],
  ["PROC-O2-PRONGS","Oxygen Therapy - Nasal Prongs","procedure",400],
  ["PROC-NEB","Nebulization","procedure",500],
  ["PROC-SUCTION","Nasopharyngeal Suction","procedure",400],
  ["PROC-ANC","ANC Visit","procedure",500],
  ["PROC-DELIVERY","Normal Vaginal Delivery (NVD)","procedure",8000],
  ["PROC-ASSISTED","Assisted Delivery (Vacuum/Forceps)","procedure",12000],
  ["PROC-CS","Caesarean Section (CS)","procedure",35000],
  ["PROC-EPISIO","Episiotomy and Repair","procedure",3000],
  ["PROC-MVA","Manual Vacuum Aspiration (MVA)","procedure",5000],
  ["PROC-EVACUATION","Uterine Evacuation (D&C)","procedure",8000],
  ["PROC-IUD-CU","IUD Insertion - Copper (CuT)","procedure",1500],
  ["PROC-IUD-LNG","IUD Insertion - Hormonal (LNG-IUS)","procedure",3000],
  ["PROC-IUD-R","IUD Removal","procedure",800],
  ["PROC-IMPLANT","Implant Insertion (Jadelle/Implanon)","procedure",2000],
  ["PROC-IMPLANT-R","Implant Removal","procedure",1500],
  ["PROC-PAP","Pap Smear Collection","procedure",500],
  ["PROC-VIA","VIA/VILI Screening","procedure",500],
  ["PROC-CRYOTHERAPY","Cryotherapy (Cervical)","procedure",3000],
  ["PROC-DEPO","Depo Provera Injection","procedure",300],
  ["PROC-IND","Incision and Drainage (I&D)","procedure",2000],
  ["PROC-CIRC-VMC","Male Circumcision (VMC)","procedure",5000],
  ["PROC-CIRC-NEO","Neonatal Circumcision","procedure",3000],
  ["PROC-SKIN-BIOPSY","Skin/Tissue Biopsy","procedure",2000],
  ["PROC-FB-SKIN","Foreign Body Removal - Skin","procedure",1000],
  ["PROC-FB-EAR","Foreign Body Removal - Ear","procedure",800],
  ["PROC-FB-NOSE","Foreign Body Removal - Nose","procedure",800],
  ["PROC-FB-EYE","Foreign Body Removal - Eye","procedure",1000],
  ["PROC-TOOTH-S","Tooth Extraction - Simple","procedure",1500],
  ["PROC-TOOTH-C","Tooth Extraction - Complex/Surgical","procedure",3000],
  ["PROC-NAIL","Nail Avulsion (Total)","procedure",1500],
  ["PROC-NAIL-P","Nail Avulsion (Partial)","procedure",800],
  ["PROC-LIPOMA","Lipoma Excision","procedure",5000],
  ["PROC-CYST","Sebaceous Cyst Excision","procedure",4000],
  ["PROC-ECG","ECG (Electrocardiogram)","procedure",800],
  ["PROC-PEAK","Peak Flow Measurement","procedure",300],
  ["PROC-MANTOUX","Mantoux Test (TB)","procedure",500],
  ["PROC-AUDIOMETRY","Audiometry","procedure",1500],
  ["PROC-VISUAL","Visual Acuity Assessment","procedure",500],
  ["PROC-NGT","Nasogastric Tube (NGT) Insertion","procedure",800],
  ["PROC-NGT-FEED","NGT Feeding","procedure",300],
  ["PROC-CONSULT-OPD","OPD Consultation","consultation",500],
  ["PROC-CONSULT-SPEC","Specialist Review/Consultation","consultation",1500],
  ["PROC-REVIEW","Review Visit","consultation",300],
  ["PROC-EMERGENCY","Emergency Consultation","consultation",1000],
  ["VAC-BCG","BCG Vaccination","procedure",300],
  ["VAC-OPV","OPV (Oral Polio Vaccine)","procedure",200],
  ["VAC-PENTA","Pentavalent Vaccine (DPT-HepB-Hib)","procedure",500],
  ["VAC-PCV","PCV (Pneumococcal Vaccine)","procedure",500],
  ["VAC-ROTA","Rotavirus Vaccine","procedure",500],
  ["VAC-MR","Measles-Rubella (MR) Vaccine","procedure",300],
  ["VAC-HPV","HPV Vaccine","procedure",2000],
  ["VAC-YELLOW-FEVER","Yellow Fever Vaccine","procedure",2500],
  ["VAC-TYPHOID","Typhoid Vaccine","procedure",1500],
  ["VAC-TETANUS","Tetanus Toxoid (TT)","procedure",300],
  ["VAC-HEPB","Hepatitis B Vaccine","procedure",800],
  ["VAC-RABIES","Rabies Vaccine","procedure",5000],
  ["VAC-INFLUENZA","Influenza Vaccine","procedure",2000],
  ["ADMISSION-FEE","Inpatient Admission Fee","admission",2000],
  ["WARD-GENERAL","General Ward - Per Day","admission",1500],
  ["WARD-PRIVATE","Private Ward - Per Day","admission",4000],
  ["WARD-SEMI","Semi-Private Ward - Per Day","admission",2500],
  ["WARD-ICU","ICU - Per Day","admission",15000],
  ["WARD-HDU","HDU - Per Day","admission",8000],
  ["WARD-MATERNITY","Maternity Ward - Per Day","admission",2000],
  ["WARD-PEDS","Paediatric Ward - Per Day","admission",1500],
  ["WARD-NICU","NICU - Per Day","admission",10000],
  ["PROC-CERT","Medical Certificate","other",500],
  ["PROC-FORM","Medical Report/Form Filling","other",1000],
  ["PROC-AMBULANCE","Ambulance/Transfer","other",5000],
];

async function seed() {
  const client = await pool.connect();
  try {
    let inserted = 0, skipped = 0;

    // 1. Seed global defaults
    for (const [code, name, category, price] of PRICES) {
      const r = await client.query(`
        INSERT INTO service_price_defaults (service_code, name, category, default_price)
        VALUES ($1,$2,$3,$4)
        ON CONFLICT (service_code) DO NOTHING
      `, [code, name, category, price]);
      if (r.rowCount > 0) inserted++; else skipped++;
    }
    console.log(`✅ Global defaults: ${inserted} inserted, ${skipped} already existed`);

    // 2. Copy defaults into every pharmacy that has no prices yet
    const pharmacies = await client.query(
      "SELECT id FROM pharmacies WHERE id NOT IN (SELECT DISTINCT pharmacy_id FROM service_prices WHERE pharmacy_id IS NOT NULL)"
    );
    let pharmacyCount = 0;
    for (const { id } of pharmacies.rows) {
      await client.query(`
        INSERT INTO service_prices (pharmacy_id, service_code, name, category, price)
        SELECT $1, service_code, name, category, default_price
        FROM service_price_defaults
        WHERE is_active = true
        ON CONFLICT DO NOTHING
      `, [id]);
      pharmacyCount++;
    }
    console.log(`✅ Copied defaults to ${pharmacyCount} pharmacy(s) that had no prices`);

    // 3. Also copy to pharmacies that DO exist but are missing specific items
    const allPharmacies = await client.query("SELECT id FROM pharmacies");
    for (const { id } of allPharmacies.rows) {
      await client.query(`
        INSERT INTO service_prices (pharmacy_id, service_code, name, category, price)
        SELECT $1, d.service_code, d.name, d.category, d.default_price
        FROM service_price_defaults d
        WHERE d.is_active = true
          AND NOT EXISTS (
            SELECT 1 FROM service_prices sp
            WHERE sp.pharmacy_id = $1
              AND sp.service_code = d.service_code
          )
        ON CONFLICT DO NOTHING
      `, [id]);
    }
    console.log(`✅ Backfilled missing items for ${allPharmacies.rows.length} pharmacy(s)`);

  } catch(e) {
    console.error("❌ Error:", e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
