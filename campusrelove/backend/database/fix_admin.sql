-- Jalankan di phpMyAdmin > preloved_db > SQL
-- Update password admin (admin123 → bcrypt hash yang benar)

UPDATE users 
SET password = '$2a$10$aFmdLK9r55vGwHrisATnJOMcXXXvPhq7fEnEnliMkN7RXyqo44tOy'
WHERE email = 'admin@preloved.id';

-- Verifikasi
SELECT id, name, email, role, LEFT(password,20) as pw_preview FROM users WHERE email = 'admin@preloved.id';
