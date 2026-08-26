const DEFAULT_CATEGORIES = [
  { name: 'Antibiotics', description: 'Antibiotic medicines' },
  { name: 'Analgesics', description: 'Pain relief medicines' },
  { name: 'Antimalaria', description: 'Malaria treatment medicines' },
  { name: 'Antihistamines', description: 'Allergy medicines' },
  { name: 'Antifungals', description: 'Fungal infection treatments' },
  { name: 'Antiparasitics', description: 'Parasite treatment medicines' },
  { name: 'Antivirals', description: 'Viral infection treatments' },
  { name: 'Cardiovascular', description: 'Heart and blood pressure medicines' },
  { name: 'Dermatology', description: 'Skin treatment medicines' },
  { name: 'Diabetes', description: 'Diabetes management medicines' },
  { name: 'Ear, Nose & Throat', description: 'ENT medicines' },
  { name: 'Eye Drops', description: 'Ophthalmic preparations' },
  { name: 'Gastrointestinal', description: 'Digestive system medicines' },
  { name: 'Hormones', description: 'Hormone therapies' },
  { name: 'IV Fluids & Infusions', description: 'Intravenous fluids' },
  { name: 'Mental Health', description: 'Psychiatric medicines' },
  { name: 'Multivitamins', description: 'Vitamins and supplements' },
  { name: 'Musculoskeletal', description: 'Bone and muscle medicines' },
  { name: 'Neurology', description: 'Neurological medicines' },
  { name: 'Respiratory', description: 'Breathing and lung medicines' },
  { name: 'Reproductive Health', description: 'Family planning medicines' },
  { name: 'Surgical Supplies', description: 'Surgical and wound care' },
  { name: 'Urinary', description: 'Urinary tract medicines' },
  { name: 'Vaccines', description: 'Immunization products' },
  { name: 'Veterinary', description: 'Animal medicines' },
];

const seedDefaultCategories = async (pool, pharmacy_id) => {
  for (const cat of DEFAULT_CATEGORIES) {
    await pool.query(`
      INSERT INTO categories (name, description, pharmacy_id)
      VALUES ($1, $2, $3) ON CONFLICT DO NOTHING
    `, [cat.name, cat.description, pharmacy_id]);
  }
};

module.exports = { seedDefaultCategories, DEFAULT_CATEGORIES };
