/*
  # Seed Initial Data for Sinnara Platform

  ## Contents
  1. Create Platform Admin account
  2. Create sample companies (2 companies)
  3. Create Company Admin accounts for each company
  4. Create sample employees
  5. Create sample courses
  6. Create sample exams with questions
  7. Create public assessment questions (stored as exam)
*/

-- Insert Platform Admin (password: admin123)
INSERT INTO users (email, password, full_name, role, phone)
VALUES ('admin@sinnara.com', 'admin123', 'Platform Administrator', 'PLATFORM_ADMIN', '+966501234567')
ON CONFLICT (email) DO NOTHING;

-- Insert Companies
INSERT INTO companies (id, name, package_type, license_limit)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Tech Corp Solutions', 'TYPE_A', 50),
  ('22222222-2222-2222-2222-222222222222', 'Secure Bank Ltd', 'TYPE_B', 100)
ON CONFLICT (id) DO NOTHING;

-- Insert Company Admins (password: company123)
INSERT INTO users (email, password, full_name, role, company_id, phone)
VALUES 
  ('admin@techcorp.com', 'company123', 'Ahmed Al-Saudi', 'COMPANY_ADMIN', '11111111-1111-1111-1111-111111111111', '+966502345678'),
  ('admin@securebank.com', 'company123', 'Fatima Al-Mutairi', 'COMPANY_ADMIN', '22222222-2222-2222-2222-222222222222', '+966503456789')
ON CONFLICT (email) DO NOTHING;

-- Insert Sample Employees for Tech Corp (password: employee123)
INSERT INTO users (email, password, full_name, role, company_id, employee_id, phone)
VALUES 
  ('mohammed@techcorp.com', 'employee123', 'Mohammed Ahmed', 'EMPLOYEE', '11111111-1111-1111-1111-111111111111', 'TC001', '+966504567890'),
  ('sara@techcorp.com', 'employee123', 'Sara Abdullah', 'EMPLOYEE', '11111111-1111-1111-1111-111111111111', 'TC002', '+966505678901'),
  ('khalid@techcorp.com', 'employee123', 'Khalid Hassan', 'EMPLOYEE', '11111111-1111-1111-1111-111111111111', 'TC003', '+966506789012')
ON CONFLICT (email) DO NOTHING;

-- Insert Sample Employees for Secure Bank (password: employee123)
INSERT INTO users (email, password, full_name, role, company_id, employee_id, phone)
VALUES 
  ('abdullah@securebank.com', 'employee123', 'Abdullah Omar', 'EMPLOYEE', '22222222-2222-2222-2222-222222222222', 'SB001', '+966507890123'),
  ('noura@securebank.com', 'employee123', 'Noura Salem', 'EMPLOYEE', '22222222-2222-2222-2222-222222222222', 'SB002', '+966508901234')
ON CONFLICT (email) DO NOTHING;

-- Insert Sample Courses
INSERT INTO courses (id, title, description, content_type, duration_minutes, order_index)
VALUES 
  ('c1111111-1111-1111-1111-111111111111', 'Introduction to Cybersecurity', 'Learn the fundamentals of cybersecurity and why it matters for your organization.', 'TEXT', 45, 1),
  ('c2222222-2222-2222-2222-222222222222', 'Phishing Awareness', 'Understand how phishing attacks work and how to identify suspicious emails.', 'TEXT', 30, 2),
  ('c3333333-3333-3333-3333-333333333333', 'Password Security Best Practices', 'Master the art of creating and managing strong passwords.', 'TEXT', 25, 3),
  ('c4444444-4444-4444-4444-444444444444', 'Social Engineering Tactics', 'Learn about social engineering and how attackers manipulate people.', 'TEXT', 35, 4),
  ('c5555555-5555-5555-5555-555555555555', 'Secure Remote Work', 'Best practices for maintaining security while working remotely.', 'TEXT', 40, 5)
ON CONFLICT (id) DO NOTHING;

-- Insert Course Quizzes
INSERT INTO quizzes (course_id, question, options, correct_answer, explanation, order_index)
VALUES 
  ('c1111111-1111-1111-1111-111111111111', 'What is the primary goal of cybersecurity?', 
   '["Protect data and systems", "Make computers faster", "Install antivirus only", "Block all websites"]',
   'Protect data and systems', 
   'Cybersecurity aims to protect information and systems from unauthorized access, use, disclosure, disruption, modification, or destruction.',
   1),
  ('c2222222-2222-2222-2222-222222222222', 'Which of the following is a sign of a phishing email?',
   '["Urgent requests for personal information", "Professional email signature", "Company logo", "Formal greeting"]',
   'Urgent requests for personal information',
   'Phishing emails often create a sense of urgency to trick recipients into providing sensitive information.',
   1),
  ('c3333333-3333-3333-3333-333333333333', 'How often should you change your passwords?',
   '["Every 3-6 months", "Once a year", "Never", "Every week"]',
   'Every 3-6 months',
   'Regular password changes help maintain security, especially if passwords may have been compromised.',
   1)
ON CONFLICT DO NOTHING;

-- Insert Pre-Assessment Exam
INSERT INTO exams (id, title, description, exam_type, passing_score, time_limit_minutes)
VALUES 
  ('e1111111-1111-1111-1111-111111111111', 'Cybersecurity Pre-Assessment', 'Initial assessment to measure your current cybersecurity awareness level.', 'PRE_ASSESSMENT', 70, 30)
ON CONFLICT (id) DO NOTHING;

-- Insert Post-Assessment Exam
INSERT INTO exams (id, title, description, exam_type, passing_score, time_limit_minutes)
VALUES 
  ('e2222222-2222-2222-2222-222222222222', 'Cybersecurity Post-Assessment', 'Final assessment to measure your improvement in cybersecurity awareness.', 'POST_ASSESSMENT', 70, 30)
ON CONFLICT (id) DO NOTHING;

-- Insert Public Assessment Exam
INSERT INTO exams (id, title, description, exam_type, passing_score, time_limit_minutes)
VALUES 
  ('e3333333-3333-3333-3333-333333333333', 'Free Cybersecurity Awareness Test', 'Test your cybersecurity knowledge with this free assessment.', 'GENERAL', 70, 20)
ON CONFLICT (id) DO NOTHING;

-- Insert Exam Questions for Pre/Post Assessment (15 questions each)
INSERT INTO exam_questions (exam_id, question, options, correct_answer, explanation, order_index)
VALUES 
  -- Pre-Assessment Questions
  ('e1111111-1111-1111-1111-111111111111', 'What is phishing?',
   '["A fraudulent attempt to obtain sensitive information", "A type of firewall", "A programming language", "An antivirus software"]',
   'A fraudulent attempt to obtain sensitive information',
   'Phishing is a social engineering attack where attackers trick people into revealing sensitive information.',
   1),
  ('e1111111-1111-1111-1111-111111111111', 'Which password is the strongest?',
   '["P@ssw0rd!", "password123", "12345678", "admin"]',
   'P@ssw0rd!',
   'Strong passwords contain a mix of uppercase, lowercase, numbers, and special characters.',
   2),
  ('e1111111-1111-1111-1111-111111111111', 'What should you do if you receive a suspicious email?',
   '["Report it and delete it", "Click links to verify", "Reply with your password", "Forward to everyone"]',
   'Report it and delete it',
   'Always report suspicious emails to IT and delete them without clicking any links.',
   3),
  ('e1111111-1111-1111-1111-111111111111', 'What is two-factor authentication (2FA)?',
   '["Extra security layer requiring two forms of verification", "Using two passwords", "Logging in twice", "Having two email accounts"]',
   'Extra security layer requiring two forms of verification',
   '2FA adds an extra layer of security by requiring something you know (password) and something you have (phone/token).',
   4),
  ('e1111111-1111-1111-1111-111111111111', 'Which of these is a safe browsing practice?',
   '["Look for HTTPS in the URL", "Click on pop-up ads", "Download files from unknown sources", "Disable security warnings"]',
   'Look for HTTPS in the URL',
   'HTTPS indicates an encrypted connection, making it safer to enter sensitive information.',
   5),
  ('e1111111-1111-1111-1111-111111111111', 'What is malware?',
   '["Malicious software designed to harm systems", "A type of hardware", "An email provider", "A web browser"]',
   'Malicious software designed to harm systems',
   'Malware includes viruses, trojans, ransomware, and other harmful software.',
   6),
  ('e1111111-1111-1111-1111-111111111111', 'How often should you update your software?',
   '["As soon as updates are available", "Once a year", "Never", "Only when it stops working"]',
   'As soon as updates are available',
   'Regular updates patch security vulnerabilities and protect against new threats.',
   7),
  ('e1111111-1111-1111-1111-111111111111', 'What is ransomware?',
   '["Malware that encrypts files and demands payment", "Free software", "A backup tool", "A password manager"]',
   'Malware that encrypts files and demands payment',
   'Ransomware locks your files and demands money for the decryption key.',
   8),
  ('e1111111-1111-1111-1111-111111111111', 'Which device should have antivirus protection?',
   '["All devices including phones and tablets", "Only desktop computers", "Only work computers", "Only servers"]',
   'All devices including phones and tablets',
   'All connected devices are potential targets and should be protected.',
   9),
  ('e1111111-1111-1111-1111-111111111111', 'What is social engineering?',
   '["Manipulating people to divulge confidential information", "Building social media apps", "Networking events", "Team building activities"]',
   'Manipulating people to divulge confidential information',
   'Social engineering exploits human psychology rather than technical vulnerabilities.',
   10),
  ('e1111111-1111-1111-1111-111111111111', 'What should you do before clicking a link in an email?',
   '["Hover over it to see the actual URL", "Click it immediately", "Forward the email", "Reply to sender"]',
   'Hover over it to see the actual URL',
   'Hovering reveals the true destination and helps identify fraudulent links.',
   11),
  ('e1111111-1111-1111-1111-111111111111', 'What is a VPN used for?',
   '["Creating secure encrypted connections over the internet", "Playing games", "Sending emails", "Making phone calls"]',
   'Creating secure encrypted connections over the internet',
   'VPNs protect your data by encrypting your internet connection.',
   12),
  ('e1111111-1111-1111-1111-111111111111', 'Which information should you never share online?',
   '["Passwords and PINs", "Your favorite color", "Your job title", "Your city"]',
   'Passwords and PINs',
   'Never share authentication credentials or financial PINs online.',
   13),
  ('e1111111-1111-1111-1111-111111111111', 'What is the best way to store passwords?',
   '["Use a password manager", "Write them on sticky notes", "Save in a text file", "Use the same password everywhere"]',
   'Use a password manager',
   'Password managers securely store and generate strong unique passwords.',
   14),
  ('e1111111-1111-1111-1111-111111111111', 'What should you do if your device is lost or stolen?',
   '["Report it immediately and change all passwords", "Wait a few days", "Do nothing", "Post about it on social media"]',
   'Report it immediately and change all passwords',
   'Quick action prevents unauthorized access to your accounts and data.',
   15);

-- Copy same questions to Post-Assessment
INSERT INTO exam_questions (exam_id, question, options, correct_answer, explanation, order_index)
SELECT 'e2222222-2222-2222-2222-222222222222', question, options, correct_answer, explanation, order_index
FROM exam_questions
WHERE exam_id = 'e1111111-1111-1111-1111-111111111111'
ON CONFLICT DO NOTHING;

-- Insert Public Assessment Questions (10 questions)
INSERT INTO exam_questions (exam_id, question, options, correct_answer, explanation, order_index)
VALUES 
  ('e3333333-3333-3333-3333-333333333333', 'What is phishing?',
   '["A fraudulent attempt to obtain sensitive information", "A type of firewall", "A programming language", "An antivirus software"]',
   'A fraudulent attempt to obtain sensitive information',
   'Phishing is a social engineering attack where attackers trick people into revealing sensitive information.',
   1),
  ('e3333333-3333-3333-3333-333333333333', 'Which password is the strongest?',
   '["P@ssw0rd!2024", "password", "123456", "qwerty"]',
   'P@ssw0rd!2024',
   'Strong passwords contain uppercase, lowercase, numbers, and special characters.',
   2),
  ('e3333333-3333-3333-3333-333333333333', 'What should you do if you receive a suspicious email?',
   '["Report it and delete it", "Click links to verify", "Reply with your info", "Forward to friends"]',
   'Report it and delete it',
   'Always report suspicious emails to IT and delete them without interaction.',
   3),
  ('e3333333-3333-3333-3333-333333333333', 'What is two-factor authentication?',
   '["Extra verification beyond password", "Using two passwords", "Logging in twice", "Two email accounts"]',
   'Extra verification beyond password',
   '2FA requires something you know (password) and something you have (phone/token).',
   4),
  ('e3333333-3333-3333-3333-333333333333', 'Which indicates a secure website?',
   '["HTTPS in the URL", "Colorful design", "Many pop-ups", ".com domain"]',
   'HTTPS in the URL',
   'HTTPS means the connection is encrypted and more secure.',
   5),
  ('e3333333-3333-3333-3333-333333333333', 'What is malware?',
   '["Harmful software", "Good software", "Hardware component", "Email service"]',
   'Harmful software',
   'Malware includes viruses, trojans, and other malicious programs.',
   6),
  ('e3333333-3333-3333-3333-333333333333', 'How often should you update software?',
   '["As soon as updates are available", "Once a year", "Never", "When it breaks"]',
   'As soon as updates are available',
   'Updates patch security holes and protect against threats.',
   7),
  ('e3333333-3333-3333-3333-333333333333', 'What is ransomware?',
   '["Malware that locks files for ransom", "Free software", "Backup tool", "Browser extension"]',
   'Malware that locks files for ransom',
   'Ransomware encrypts your data and demands payment.',
   8),
  ('e3333333-3333-3333-3333-333333333333', 'What is social engineering?',
   '["Manipulating people for information", "Social media marketing", "Networking", "Team building"]',
   'Manipulating people for information',
   'Social engineering exploits human psychology to gain access.',
   9),
  ('e3333333-3333-3333-3333-333333333333', 'What is a VPN?',
   '["Secure encrypted internet connection", "Video game", "Email app", "Social network"]',
   'Secure encrypted internet connection',
   'VPNs encrypt your connection for privacy and security.',
   10)
ON CONFLICT DO NOTHING;