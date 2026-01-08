/*
  EmailJS configuration (optional)

  Goal:
  - After checkout, send an email to the CUSTOMER (the email they entered).
  - You can configure EmailJS by filling the fields below.

  Steps:
  1) Create an EmailJS account
  2) Create a Service (Gmail / SMTP / etc.)
  3) Create an Email Template
  4) Paste the values here:
     - publicKey (EmailJS public key)
     - serviceId
     - templateId

  Template variables this project sends:
    {{to_email}}
    {{to_name}}
    {{order_id}}
    {{order_total}}
    {{order_items}}
    {{customer_phone}}
    {{customer_address}}

  Important:
  - In your EmailJS template settings, make sure the "To Email" field uses {{to_email}}.
*/

window.EMAILJS_CONFIG = {
  enabled: false,     // set to true after you fill keys
  publicKey: "",      // e.g. "abcdEFGHijk..."
  serviceId: "",      // e.g. "service_xxxxx"
  templateId: ""      // e.g. "template_yyyyy"
};
