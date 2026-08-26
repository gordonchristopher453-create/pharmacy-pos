const { pool } = require('../config/db');

/**
 * Clinical Decision Support (CDS) Engine
 * Evaluates patient history, active diagnoses, medications, lab results, and proposed orders
 * to produce real-time, non-blocking clinical safety alerts.
 */

// Drug Interaction Knowledge Base Matrix
const DRUG_INTERACTION_RULES = [
  {
    drugs: ['warfarin', 'aspirin'],
    severity: 'HIGH',
    type: 'DRUG_INTERACTION',
    summary: 'High Risk of Severe Hemorrhage',
    recommendation: 'Combining Warfarin with Aspirin significantly increases bleeding risk. Monitor INR closely or consider alternative antiplatelet/anticoagulant therapy.'
  },
  {
    drugs: ['warfarin', 'ibuprofen'],
    severity: 'HIGH',
    type: 'DRUG_INTERACTION',
    summary: 'Increased Gastrointestinal & Major Bleeding Risk',
    recommendation: 'NSAIDs increase ulceration risk and displace Warfarin from plasma proteins.'
  },
  {
    drugs: ['enalapril', 'spironolactone'],
    severity: 'HIGH',
    type: 'DRUG_INTERACTION',
    summary: 'Severe Hyperkalemia Risk',
    recommendation: 'Concomitant ACE inhibitor and potassium-sparing diuretic can lead to life-threatening hyperkalemia. Monitor serum potassium.'
  },
  {
    drugs: ['lisinopril', 'spironolactone'],
    severity: 'HIGH',
    type: 'DRUG_INTERACTION',
    summary: 'Severe Hyperkalemia Risk',
    recommendation: 'Concomitant ACE inhibitor and potassium-sparing diuretic can lead to life-threatening hyperkalemia. Monitor serum potassium.'
  },
  {
    drugs: ['metformin', 'contrast'],
    severity: 'HIGH',
    type: 'DRUG_INTERACTION',
    summary: 'Lactic Acidosis Risk with Radiocontrast',
    recommendation: 'Withhold Metformin 48 hours prior to and after administration of intravascular iodinated radiocontrast media.'
  },
  {
    drugs: ['ciprofloxacin', 'antacid'],
    severity: 'MEDIUM',
    type: 'DRUG_INTERACTION',
    summary: 'Reduced Antibiotic Absorption',
    recommendation: 'Polyvalent cations (aluminum/magnesium in antacids) chelate Ciprofloxacin. Administer at least 2 hours before or 6 hours after antacids.'
  },
  {
    drugs: ['tramadol', 'fluoxetine'],
    severity: 'HIGH',
    type: 'DRUG_INTERACTION',
    summary: 'Serotonin Syndrome & Seizure Threshold Reduction',
    recommendation: 'Combining SSRIs with Tramadol increases the risk of Serotonin Syndrome and lowers seizure threshold.'
  },
  {
    drugs: ['simvastatin', 'erythromycin'],
    severity: 'HIGH',
    type: 'DRUG_INTERACTION',
    summary: 'Increased Risk of Rhabdomyolysis',
    recommendation: 'Macrolides inhibit CYP3A4, causing statin accumulation and acute muscle toxicity.'
  },
  {
    drugs: ['clopidogrel', 'omeprazole'],
    severity: 'MEDIUM',
    type: 'DRUG_INTERACTION',
    summary: 'Reduced Antiplatelet Efficacy',
    recommendation: 'Omeprazole inhibits CYP2C19, preventing activation of Clopidogrel. Consider Pantoprazole or H2 blocker.'
  }
];

// Pregnancy Contraindicated Medications
const PREGNANCY_CONTRAINDICATED_DRUGS = [
  'warfarin', 'doxycycline', 'methotrexate', 'lisinopril', 'enalapril',
  'losartan', 'valsartan', 'simvastatin', 'atorvastatin', 'ciprofloxacin',
  'phenytoin', 'valproic acid', 'carbamazepine', 'tetracycline', 'misoprostol'
];

// Pediatric Contraindicated Medications (<16 years)
const PEDIATRIC_CONTRAINDICATED_DRUGS = [
  'aspirin', 'ciprofloxacin', 'levofloxacin', 'doxycycline', 'tetracycline', 'codeine'
];

async function evaluateCDS({
  pharmacy_id,
  patient_id,
  visit_id,
  encounter_id,
  proposed_medications = [],
  proposed_lab_requests = [],
  proposed_radiology_requests = [],
  diagnoses = [],
  vitals = {}
}) {
  const alerts = [];

  try {
    // 1. Fetch Patient Demographics, History & Known Allergies
    const patientRes = await pool.query(
      `SELECT *, CASE WHEN date_of_birth IS NOT NULL THEN EXTRACT(YEAR FROM AGE(NOW(), date_of_birth))::int ELSE NULL END as calculated_age FROM patients WHERE id = $1`,
      [patient_id]
    );
    const patient = patientRes.rows[0];
    if (!patient) return { alerts: [] };

    const age = patient.calculated_age || (patient.age ? parseInt(patient.age) : null) || 30;
    const gender = (patient.gender || '').toLowerCase();

    // Parse known allergies from patient record
    let knownAllergies = [];
    if (patient.allergies) {
      if (typeof patient.allergies === 'string') {
        knownAllergies = patient.allergies.toLowerCase().split(/[,;]+/).map(a => a.trim()).filter(Boolean);
      } else if (Array.isArray(patient.allergies)) {
        knownAllergies = patient.allergies.map(a => String(a).toLowerCase().trim());
      }
    }

    // Check if patient is currently recorded as pregnant
    const isPregnant = (patient.is_pregnant === true) ||
                       (gender === 'female' && (patient.pregnancy_status || '').toLowerCase().includes('pregnant')) ||
                       diagnoses.some(d => (d.name || d.icd_code_description || '').toLowerCase().includes('pregnan'));

    // 2. Fetch Active Medications in current visit or recent prescriptions
    const activeMedsRes = await pool.query(
      `SELECT drug_name, medication_name, items
       FROM prescriptions
       WHERE patient_id = $1 AND created_at >= NOW() - INTERVAL '30 days'`,
      [patient_id]
    );
    const activeMedNames = activeMedsRes.rows.flatMap(r => {
      const names = [];
      if (r.drug_name) names.push(r.drug_name.toLowerCase());
      if (r.medication_name) names.push(r.medication_name.toLowerCase());
      if (r.items && Array.isArray(r.items)) {
        r.items.forEach(it => { if (it.drug_name) names.push(it.drug_name.toLowerCase()); });
      }
      return names;
    }).filter(Boolean);

    // Combine active medications with proposed medications for checking
    const newMedNames = proposed_medications.map(m => (m.drug_name || m.name || '').toLowerCase()).filter(Boolean);
    const allMedNames = [...new Set([...activeMedNames, ...newMedNames])];

    // ----------------------------------------------------
    // CHECK 1: Drug Allergies
    // ----------------------------------------------------
    for (const newMed of newMedNames) {
      for (const allergy of knownAllergies) {
        if (newMed.includes(allergy) || allergy.includes(newMed)) {
          alerts.push({
            type: 'DRUG_ALLERGY',
            severity: 'HIGH',
            summary: `Drug Allergy Alert: ${newMed.toUpperCase()}`,
            details: `Patient has a documented allergy to "${allergy.toUpperCase()}". Administering "${newMed.toUpperCase()}" may trigger an adverse reaction.`,
            drug_name: newMed,
            allergy_term: allergy
          });
        }
      }
    }

    // ----------------------------------------------------
    // CHECK 2: Drug-Drug Interactions
    // ----------------------------------------------------
    for (const rule of DRUG_INTERACTION_RULES) {
      const match1 = allMedNames.some(m => m.includes(rule.drugs[0]));
      const match2 = allMedNames.some(m => m.includes(rule.drugs[1]));
      if (match1 && match2) {
        alerts.push({
          type: rule.type,
          severity: rule.severity,
          summary: `Drug Interaction: ${rule.drugs[0].toUpperCase()} + ${rule.drugs[1].toUpperCase()}`,
          details: `${rule.summary}. ${rule.recommendation}`,
          involved_drugs: rule.drugs
        });
      }
    }

    // ----------------------------------------------------
    // CHECK 3: Duplicate Medication Orders
    // ----------------------------------------------------
    const medCounts = {};
    for (const med of newMedNames) {
      medCounts[med] = (medCounts[med] || 0) + 1;
      if (activeMedNames.includes(med)) {
        alerts.push({
          type: 'DUPLICATE_MEDICATION',
          severity: 'MEDIUM',
          summary: `Duplicate Active Medication: ${med.toUpperCase()}`,
          details: `Patient already has an active prescription for ${med.toUpperCase()} within the last 30 days. Verify dosing before ordering again.`,
          drug_name: med
        });
      }
    }
    for (const [med, count] of Object.entries(medCounts)) {
      if (count > 1) {
        alerts.push({
          type: 'DUPLICATE_MEDICATION',
          severity: 'MEDIUM',
          summary: `Duplicate Prescription in Current Order: ${med.toUpperCase()}`,
          details: `${med.toUpperCase()} has been included multiple times in this order.`,
          drug_name: med
        });
      }
    }

    // ----------------------------------------------------
    // CHECK 4: Duplicate Lab / Radiology Requests
    // ----------------------------------------------------
    if (proposed_lab_requests.length > 0) {
      const recentLabs = await pool.query(
        `SELECT test_name FROM lab_requests WHERE patient_id = $1 AND created_at >= NOW() - INTERVAL '48 hours'`,
        [patient_id]
      );
      const recentLabNames = recentLabs.rows.map(r => (r.test_name || '').toLowerCase());
      for (const lab of proposed_lab_requests) {
        const labName = (lab.test_name || lab.name || '').toLowerCase();
        if (recentLabNames.includes(labName)) {
          alerts.push({
            type: 'DUPLICATE_LAB_REQUEST',
            severity: 'LOW',
            summary: `Recent Lab Test Requested: ${labName.toUpperCase()}`,
            details: `A lab request for "${labName.toUpperCase()}" was submitted within the past 48 hours for this patient.`,
            test_name: labName
          });
        }
      }
    }

    if (proposed_radiology_requests.length > 0) {
      const recentRads = await pool.query(
        `SELECT service_name FROM service_orders WHERE patient_id = $1 AND created_at >= NOW() - INTERVAL '48 hours'`,
        [patient_id]
      );
      const recentRadNames = recentRads.rows.map(r => (r.service_name || '').toLowerCase());
      for (const rad of proposed_radiology_requests) {
        const radName = (rad.service_name || rad.name || '').toLowerCase();
        if (recentRadNames.includes(radName)) {
          alerts.push({
            type: 'DUPLICATE_RADIOLOGY_REQUEST',
            severity: 'LOW',
            summary: `Recent Radiology Request: ${radName.toUpperCase()}`,
            details: `A imaging/radiology order for "${radName.toUpperCase()}" was submitted within the past 48 hours.`,
            service_name: radName
          });
        }
      }
    }

    // ----------------------------------------------------
    // CHECK 5: Age & Weight Warnings
    // ----------------------------------------------------
    if (age < 16) {
      for (const newMed of newMedNames) {
        for (const contra of PEDIATRIC_CONTRAINDICATED_DRUGS) {
          if (newMed.includes(contra)) {
            alerts.push({
              type: 'PEDIATRIC_WARNING',
              severity: 'HIGH',
              summary: `Pediatric Contraindication Warning: ${newMed.toUpperCase()}`,
              details: `Patient is ${age} years old. ${newMed.toUpperCase()} is generally contraindicated or requires strict age-adjusted dosing in pediatric patients under 16 years.`,
              drug_name: newMed
            });
          }
        }
      }
    }

    // ----------------------------------------------------
    // CHECK 6: Pregnancy Medication Warnings
    // ----------------------------------------------------
    if (isPregnant) {
      for (const newMed of newMedNames) {
        for (const contra of PREGNANCY_CONTRAINDICATED_DRUGS) {
          if (newMed.includes(contra)) {
            alerts.push({
              type: 'PREGNANCY_WARNING',
              severity: 'HIGH',
              summary: `Pregnancy Category Safety Warning: ${newMed.toUpperCase()}`,
              details: `Patient is pregnant. ${newMed.toUpperCase()} poses teratogenic or adverse fetal risks. Review safer alternative options.`,
              drug_name: newMed
            });
          }
        }
      }
    }

    // ----------------------------------------------------
    // CHECK 7: Chronic Disease & Vital Sign Reminders
    // ----------------------------------------------------
    const allDiagnosesNames = diagnoses.map(d => (d.name || d.icd_code_description || '').toLowerCase());
    const isHypertensive = allDiagnosesNames.some(d => d.includes('hypertension') || d.includes('high blood pressure'));
    const isDiabetic = allDiagnosesNames.some(d => d.includes('diabetes') || d.includes('diabetic'));

    if (isHypertensive && vitals.systolic && vitals.systolic >= 140) {
      alerts.push({
        type: 'CLINICAL_REMINDER',
        severity: 'MEDIUM',
        summary: 'Elevated Systolic Blood Pressure in Hypertensive Patient',
        details: `Recorded Systolic BP is ${vitals.systolic} mmHg. Consider reviewing antihypertensive dosage or adherence.`,
        vital_parameter: 'systolic'
      });
    }

    if (isDiabetic) {
      // Check if HbA1c test was done in last 90 days
      const hba1cRes = await pool.query(
        `SELECT created_at FROM lab_requests WHERE patient_id = $1 AND LOWER(test_name) LIKE '%hba1c%' AND created_at >= NOW() - INTERVAL '90 days'`,
        [patient_id]
      );
      if (hba1cRes.rows.length === 0) {
        alerts.push({
          type: 'CLINICAL_REMINDER',
          severity: 'INFO',
          summary: 'Routine Diabetes Monitoring: HbA1c Recommended',
          details: 'Diabetic patient has no recorded HbA1c lab test in the past 90 days. Consider ordering HbA1c.',
          recommendation: 'Order HbA1c lab test'
        });
      }
    }

    // Log alerts to database for audit trail
    for (const alert of alerts) {
      await pool.query(
        `INSERT INTO cds_alert_logs (pharmacy_id, visit_id, encounter_id, patient_id, alert_type, severity, summary, details, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          pharmacy_id || null,
          visit_id || null,
          encounter_id || null,
          patient_id,
          alert.type,
          alert.severity,
          alert.summary,
          JSON.stringify(alert)
        ]
      );
    }

    return { alerts };
  } catch (err) {
    console.error('Error evaluating CDS rules:', err.message);
    return { alerts: [] };
  }
}

module.exports = {
  evaluateCDS,
  DRUG_INTERACTION_RULES,
  PREGNANCY_CONTRAINDICATED_DRUGS,
  PEDIATRIC_CONTRAINDICATED_DRUGS
};
