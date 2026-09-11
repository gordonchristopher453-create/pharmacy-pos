/**
 * PERMISSION-BASED ROLES & PERMISSIONS CONFIG
 * Supports dispensaries, clinics, health centres, hospitals, multi-branch networks.
 */

const PERMISSIONS = {
  // Patient & Registration
  CAN_REGISTER_PATIENTS:        'can_register_patients',
  CAN_MANAGE_VISITS:            'can_manage_visits',
  CAN_BOOK_APPOINTMENTS:        'can_book_appointments',
  CAN_MANAGE_QUEUE:             'can_manage_queue',
  CAN_SEARCH_PATIENTS:          'can_search_patients',
  CAN_VIEW_PATIENT_DEMOGRAPHICS:'can_view_patient_demographics',

  // Billing & Payments
  CAN_CREATE_BILLS:             'can_create_bills',
  CAN_RECEIVE_PAYMENTS:         'can_receive_payments',
  CAN_PRINT_RECEIPTS:           'can_print_receipts',
  CAN_PRINT_INVOICES:           'can_print_invoices',
  CAN_VIEW_DAILY_COLLECTIONS:   'can_view_daily_collections',
  CAN_VIEW_CASH_REPORTS:        'can_view_cash_reports',
  CAN_ACCESS_POS:               'can_access_pos',

  // SHA / NHIF Claims
  CAN_VERIFY_SHA_PATIENTS:      'can_verify_sha_patients',
  CAN_CREATE_SHA_CLAIMS:        'can_create_sha_claims',
  CAN_SUBMIT_SHA_CLAIMS:        'can_submit_sha_claims',
  CAN_TRACK_SHA_CLAIMS:         'can_track_sha_claims',
  CAN_MANAGE_CLAIM_REJECTIONS:  'can_manage_claim_rejections',
  CAN_VIEW_CLAIM_REPORTS:       'can_view_claim_reports',

  // Finance / Accountant
  CAN_VIEW_FINANCIAL_REPORTS:   "can_view_financial_reports",   
  CAN_VIEW_REVENUE_REPORTS:     'can_view_revenue_reports',
  CAN_VIEW_RECONCILIATION:      'can_view_reconciliation',
  CAN_VIEW_OUTSTANDING_BALANCES:'can_view_outstanding_balances',
  CAN_VIEW_AUDIT_REPORTS:       'can_view_audit_reports',
  CAN_VIEW_EXECUTIVE_DASHBOARD: 'can_view_executive_dashboard',
  CAN_VIEW_ALL_REPORTS:         'can_view_all_reports',

  // Clinical – Nurse
  CAN_DO_TRIAGE:                'can_do_triage',
  CAN_RECORD_VITALS:            'can_record_vitals',
  CAN_ADD_NURSING_NOTES:        'can_add_nursing_notes',
  CAN_MANAGE_INJECTIONS:        'can_manage_injections',
  CAN_MANAGE_WARD_ACTIVITIES:   'can_manage_ward_activities',

  // Clinical – MCH Nurse
  CAN_MANAGE_ANC:               'can_manage_anc',
  CAN_MANAGE_PNC:               'can_manage_pnc',
  CAN_MANAGE_IMMUNIZATION:      'can_manage_immunization',
  CAN_MANAGE_CWC:               'can_manage_cwc',
  CAN_MANAGE_FAMILY_PLANNING:   'can_manage_family_planning',
  CAN_MANAGE_MCH:               'can_manage_mch',

  // Clinical – Doctor / Clinical Officer
  CAN_DO_CONSULTATION:          'can_do_consultation',
  CAN_MAKE_DIAGNOSES:           'can_make_diagnoses',
  CAN_WRITE_PRESCRIPTIONS:      'can_write_prescriptions',
  CAN_REQUEST_LAB:              'can_request_lab',
  CAN_REQUEST_RADIOLOGY:        'can_request_radiology',
  CAN_MANAGE_ADMISSIONS:        'can_manage_admissions',
  CAN_WRITE_DISCHARGE_SUMMARIES:'can_write_discharge_summaries',
  CAN_VIEW_CLINICAL_REPORTS:    'can_view_clinical_reports',

  // Laboratory & Radiology
  CAN_MANAGE_LAB:               'can_manage_lab',
  CAN_RECORD_LAB_RESULTS:       'can_record_lab_results',
  CAN_VALIDATE_LAB_RESULTS:     'can_validate_lab_results',
  CAN_PRINT_LAB_REPORTS:        'can_print_lab_reports',
  CAN_MANAGE_RADIOLOGY:         'can_manage_radiology',

  // Pharmacy
  CAN_DISPENSE_MEDICATION:      'can_dispense_medication',
  CAN_MANAGE_PHARMACY:          'can_manage_pharmacy',
  CAN_MANAGE_DRUG_BATCHES:      'can_manage_drug_batches',
  CAN_MANAGE_EXPIRY_TRACKING:   'can_manage_expiry_tracking',
  CAN_VIEW_PHARMACY_REPORTS:    'can_view_pharmacy_reports',

  // Inventory / Store
  CAN_MANAGE_STOCK:             'can_manage_stock',
  CAN_MANAGE_PURCHASES:         'can_manage_purchases',
  CAN_MANAGE_SUPPLIERS:         'can_manage_suppliers',
  CAN_MANAGE_STOCK_TRANSFERS:   'can_manage_stock_transfers',
  CAN_DO_STOCK_AUDITS:          'can_do_stock_audits',

  // Admin / System
  CAN_MANAGE_USERS:             'can_manage_users',
  CAN_ASSIGN_ROLES:             'can_assign_roles',
  CAN_ASSIGN_PERMISSIONS:       'can_assign_permissions',
  CAN_MANAGE_DEPARTMENTS:       'can_manage_departments',
  CAN_MANAGE_BILLING_CONFIG:    'can_manage_billing_config',
  CAN_MANAGE_SHA_SETTINGS:      'can_manage_sha_settings',
  CAN_MANAGE_MCH_CONFIG:        'can_manage_mch_config',
  CAN_MANAGE_WARDS:             'can_manage_wards',
  CAN_MANAGE_BEDS:              'can_manage_beds',
};

const ROLES = {
  super_admin:      'super_admin',
  facility_admin:   'facility_admin',
  receptionist:     'receptionist',
  cashier:          'cashier',
  sha_officer:      'sha_officer',
  accountant:       'accountant',
  nurse:            'nurse',
  mch_nurse:        'mch_nurse',
  clinical_officer: 'clinical_officer',
  doctor:           'doctor',
  lab_technician:   'lab_technician',
  radiologist:      'radiologist',
  pharmacist:       'pharmacist',
  store_manager:    'store_manager',
};

const ROLE_PERMISSIONS = {
  [ROLES.super_admin]: Object.values(PERMISSIONS),

  [ROLES.facility_admin]: [
    'can_manage_users','can_assign_roles','can_assign_permissions',
    'can_manage_departments','can_manage_billing_config','can_manage_sha_settings',
    'can_manage_mch_config','can_manage_wards','can_manage_beds',
    'can_view_all_reports','can_view_executive_dashboard',
    'can_create_bills','can_receive_payments','can_print_receipts','can_print_invoices',
    'can_view_daily_collections','can_view_cash_reports',
    'can_verify_sha_patients','can_create_sha_claims','can_submit_sha_claims',
    'can_track_sha_claims','can_manage_claim_rejections','can_view_claim_reports',
    'can_view_revenue_reports','can_view_reconciliation',
    'can_view_outstanding_balances','can_view_audit_reports',
    'can_register_patients','can_manage_visits','can_search_patients',
    'can_view_patient_demographics','can_access_pos','can_manage_radiology',
  ],

  [ROLES.receptionist]: [
    'can_register_patients','can_manage_visits','can_book_appointments',
    'can_search_patients','can_view_patient_demographics',
    'can_create_bills','can_receive_payments','can_print_receipts','can_print_invoices',
    'can_view_daily_collections','can_view_cash_reports',
    'can_manage_queue',
  ],

  [ROLES.cashier]: [
    'can_create_bills','can_receive_payments','can_print_receipts','can_print_invoices',
    'can_view_daily_collections','can_view_cash_reports','can_access_pos',
  ],

  [ROLES.sha_officer]: [
    'can_verify_sha_patients','can_create_sha_claims','can_submit_sha_claims',
    'can_track_sha_claims','can_manage_claim_rejections','can_view_claim_reports',
    'can_search_patients','can_view_patient_demographics',
    'can_create_bills','can_receive_payments','can_print_receipts','can_print_invoices',
    'can_view_daily_collections','can_view_cash_reports',
  ],

  [ROLES.accountant]: [
    'can_view_revenue_reports','can_view_reconciliation',
    'can_view_outstanding_balances','can_view_audit_reports','can_view_executive_dashboard',
    'can_view_cash_reports','can_view_daily_collections','can_view_claim_reports',
    'can_view_all_reports',
  ],

  [ROLES.nurse]: [
    'can_do_triage','can_record_vitals','can_add_nursing_notes',
    'can_manage_injections','can_manage_ward_activities',
    'can_search_patients','can_view_patient_demographics','can_manage_visits',
  ],

  [ROLES.mch_nurse]: [
    'can_do_triage','can_record_vitals','can_add_nursing_notes',
    'can_manage_anc','can_manage_pnc','can_manage_immunization',
    'can_manage_cwc','can_manage_family_planning','can_manage_mch',
    'can_search_patients','can_view_patient_demographics','can_manage_visits',
  ],

  [ROLES.clinical_officer]: [
    'can_do_consultation','can_make_diagnoses','can_write_prescriptions',
    'can_request_lab','can_request_radiology','can_manage_admissions',
    'can_write_discharge_summaries','can_view_clinical_reports',
    'can_search_patients','can_view_patient_demographics','can_manage_visits',
  ],

  [ROLES.doctor]: [
    'can_do_consultation','can_make_diagnoses','can_write_prescriptions',
    'can_request_lab','can_request_radiology','can_manage_admissions',
    'can_write_discharge_summaries','can_view_clinical_reports',
    'can_search_patients','can_view_patient_demographics','can_manage_visits',
  ],

  [ROLES.lab_technician]: [
    'can_manage_lab','can_record_lab_results','can_validate_lab_results',
    'can_search_patients','can_view_patient_demographics',
  ],

  [ROLES.radiologist]: [
    'can_manage_radiology','can_search_patients','can_view_patient_demographics',
  ],

  [ROLES.pharmacist]: [
    'can_access_pos','can_dispense_medication','can_manage_pharmacy',
    'can_manage_drug_batches','can_manage_expiry_tracking',
    'can_view_pharmacy_reports','can_search_patients','can_view_patient_demographics',
  ],

  [ROLES.store_manager]: [
    'can_manage_stock','can_manage_purchases','can_manage_suppliers',
    'can_manage_stock_transfers','can_do_stock_audits',
  ],
};

const ROLE_META = {
  super_admin:      { label: 'Super Admin',       icon: '⚡', color: '#a855f7' },
  facility_admin:   { label: 'Facility Admin',    icon: '👑', color: '#10b981' },
  receptionist:     { label: 'Receptionist',      icon: '📋', color: '#f97316' },
  cashier:          { label: 'Cashier',           icon: '🧾', color: '#eab308' },
  sha_officer:      { label: 'SHA Officer',       icon: '🏥', color: '#06b6d4' },
  accountant:       { label: 'Accountant',        icon: '📊', color: '#8b5cf6' },
  nurse:            { label: 'Nurse',             icon: '🩺', color: '#ec4899' },
  mch_nurse:        { label: 'MCH Nurse',         icon: '👶', color: '#f43f5e' },
  clinical_officer: { label: 'Clinical Officer',  icon: '🩻', color: '#3b82f6' },
  doctor:           { label: 'Doctor',            icon: '👨‍⚕️', color: '#3b82f6' },
  lab_technician:   { label: 'Lab Technologist',  icon: '🔬', color: '#06b6d4' },
  radiologist:      { label: 'Radiology Tech',    icon: '📸', color: '#f97316' },
  pharmacist:       { label: 'Pharmacist',        icon: '💊', color: '#10b981' },
  store_manager:    { label: 'Store Manager',     icon: '📦', color: '#84cc16' },
};

module.exports = { PERMISSIONS, ROLES, ROLE_PERMISSIONS, ROLE_META };
