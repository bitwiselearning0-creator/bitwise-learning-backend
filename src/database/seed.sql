-- Bitwise Learning Seed SQL Script
-- Seed data for local database development

-- Clear existing data (in case there's any)
TRUNCATE watch_progress, videos, subscriptions, purchases, bundle_contents, bundles, contents, users, courses, departments, academic_sessions, subjects, announcements CASCADE;

-- 1. Insert admin and normal test users
INSERT INTO users (id, email, full_name, firebase_uid, role, status, device_id) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'aditya@example.com', 'Aditya Kumar', 'mock_uid_aditya@example.com', 'user', 'active', 'device_simulator_id_999'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'admin@bitwise.com', 'Admin Toppers', 'mock_uid_admin@bitwise.com', 'admin', 'active', NULL);

-- 2. Seed Courses
INSERT INTO courses (id, name, badge, is_enabled) VALUES
('c_cse', 'B.Tech (Computer Science & Engineering)', 'POPULAR', TRUE),
('c_it', 'B.Tech (Information Technology)', NULL, TRUE),
('c_ece', 'B.Tech (Electronics & Communication)', NULL, TRUE);

-- 3. Seed Departments
INSERT INTO departments (id, name, course_id) VALUES
('d_cse', 'Computer Science & Engineering', 'c_cse'),
('d_it', 'Information Technology', 'c_it');

-- 4. Seed Academic Sessions
INSERT INTO academic_sessions (id, name, is_enabled) VALUES
('s_2026', '2026-27', TRUE);

-- 5. Seed Subjects
INSERT INTO subjects (id, name, course_id, department_id, year, semester) VALUES
('sub_os', 'Operating Systems', 'c_cse', 'd_cse', 2, 4),
('sub_cd', 'Compiler Design', 'c_cse', 'd_cse', 3, 6),
('sub_cn', 'Computer Networks', 'c_cse', 'd_cse', 3, 5),
('sub_dbms', 'Database Management Systems', 'c_cse', 'd_cse', 2, 3);

-- 6. Insert study guide notes content
INSERT INTO contents (id, title, description, type, category, semester, subject, file_key, price, is_available) VALUES
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'Advanced DSA Lecture Guide', 'Comprehensive guide to algorithms and data structures.', 'note', 'Computer Science', 4, 'Computer Science', 'notes/dsa_guide.pdf', 199.00, TRUE),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'System Design Mastery Guide', 'High Level and Low Level Design handbook.', 'note', 'Computer Science', 6, 'Computer Science', 'notes/sys_design.pdf', 299.00, TRUE);

-- 7. Insert Bundle
INSERT INTO bundles (id, title, description, price, course_id, semester, is_archived, is_available) VALUES
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11', 'Toppers Special DSA Bundle', 'Contains all premium notes for mastering DSA.', 399.00, 'c_cse', 4, FALSE, TRUE);

-- 8. Map contents to bundle
INSERT INTO bundle_contents (bundle_id, content_id) VALUES
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11'),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22');

-- 9. Insert mock active subscription for user on DSA Guide
INSERT INTO purchases (id, user_id, order_id, payment_id, purchase_type, item_id, amount, status) VALUES
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'order_dsa_111', 'pay_mock_111', 'note', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 199.00, 'completed');

INSERT INTO subscriptions (user_id, purchase_id, subscription_type, item_id, activated_at, expires_at, is_active) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380d11', 'note', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '6 months', TRUE);

-- 10. Insert lectures (Videos)
-- Includes both YouTube videos and secure HLS stream videos
INSERT INTO videos (id, title, description, youtube_video_id, playlist_name, sequence_order, hls_url) VALUES
('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e11', 'Introduction to Big-O Notation', 'Lecture on algorithm time complexity analysis.', 'DFpWCl_49i0', 'Computer Science', 1, NULL),
('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e22', 'Dynamic Programming Basics (Secure HLS)', 'Secure lecture using AES-128 encrypted HLS stream.', 'kQDxmjFKesY', 'Computer Science', 2, 'https://localhost:3000/api/v1/videos/hls/dsa_dp/playlist.m3u8');
