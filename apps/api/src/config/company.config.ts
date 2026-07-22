export const companyConfig = {
  get name() {
    return process.env.COMPANY_NAME || 'ClientFlow Systems';
  },
  get address() {
    return process.env.COMPANY_ADDRESS || '123 Business Street, Tech Park, City - 400001';
  },
  get phone() {
    return process.env.COMPANY_PHONE || '+91 9876543210';
  },
  get email() {
    return process.env.COMPANY_EMAIL || 'contact@clientflow.com';
  },
  get website() {
    return process.env.COMPANY_WEBSITE || 'www.clientflow.com';
  },
  get gst() {
    return process.env.COMPANY_GST || '';
  },
};
