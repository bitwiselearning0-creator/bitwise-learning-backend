-- Bitwise Learning Database Schema

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop tables if they exist (for clean setup)
DROP TABLE IF EXISTS doubt_messages CASCADE;
DROP TABLE IF EXISTS watch_progress CASCADE;
DROP TABLE IF EXISTS videos CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS purchases CASCADE;
DROP TABLE IF EXISTS bundle_contents CASCADE;
DROP TABLE IF EXISTS bundles CASCADE;
DROP TABLE IF EXISTS contents CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TYPE IF EXISTS content_type CASCADE;
DROP TABLE IF EXISTS announcements CASCADE;
DROP TABLE IF EXISTS subjects CASCADE;
DROP TABLE IF EXISTS academic_sessions CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS courses CASCADE;

-- Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(512),
    firebase_uid VARCHAR(128) UNIQUE NOT NULL,
    device_id VARCHAR(255),           -- Single device binding
    role VARCHAR(50) DEFAULT 'user',  -- 'user', 'admin'
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'banned'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX idx_users_email ON users(email);

-- Courses Table
CREATE TABLE courses (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    badge VARCHAR(100),
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Departments Table
CREATE TABLE departments (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    course_id VARCHAR(255) REFERENCES courses(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Academic Sessions Table
CREATE TABLE academic_sessions (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Subjects Table
CREATE TABLE subjects (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    course_id VARCHAR(255) REFERENCES courses(id) ON DELETE CASCADE,
    department_id VARCHAR(255) REFERENCES departments(id) ON DELETE CASCADE,
    year INT NOT NULL,
    semester INT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Announcements Table
CREATE TABLE announcements (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Content Type ENUM
CREATE TYPE content_type AS ENUM ('note', 'pyq');

-- Content (Notes & PYQs) Table
CREATE TABLE contents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type content_type NOT NULL,
    category VARCHAR(100) NOT NULL,    -- E.g., B.Tech, MCA
    semester INT NOT NULL,             -- E.g., 1, 2, 3
    subject VARCHAR(100) NOT NULL,     -- E.g., Mathematics, Data Structures
    year INT,                          -- For PYQs (e.g., 2024)
    file_key VARCHAR(512) NOT NULL,    -- Encrypted file key in private bucket
    price DECIMAL(10, 2) DEFAULT 0.00,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_contents_type_category_sem ON contents(type, category, semester);

-- Bundles Table (Groups of Notes/PYQs)
CREATE TABLE bundles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    course_id VARCHAR(255) REFERENCES courses(id) ON DELETE SET NULL,
    semester INT,
    is_archived BOOLEAN DEFAULT FALSE,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bundle Content Mapping Table (Many-to-Many)
CREATE TABLE bundle_contents (
    bundle_id UUID REFERENCES bundles(id) ON DELETE CASCADE,
    content_id UUID REFERENCES contents(id) ON DELETE CASCADE,
    PRIMARY KEY (bundle_id, content_id)
);

-- Purchases / Orders Table
CREATE TABLE purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    order_id VARCHAR(255) UNIQUE NOT NULL,      -- Razorpay Order ID
    payment_id VARCHAR(255) UNIQUE,             -- Razorpay Payment ID
    purchase_type VARCHAR(50) NOT NULL,         -- 'note', 'pyq', 'bundle'
    item_id UUID NOT NULL,                      -- References contents(id) or bundles(id)
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',       -- 'pending', 'completed', 'failed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_purchases_user_id ON purchases(user_id);
CREATE INDEX idx_purchases_status ON purchases(status);

-- Active Subscriptions Table (Calculates Expirations)
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    purchase_id UUID REFERENCES purchases(id) ON DELETE CASCADE,
    subscription_type VARCHAR(50) NOT NULL,     -- 'note', 'pyq', 'bundle'
    item_id UUID NOT NULL,                      -- References contents(id) or bundles(id)
    activated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL, -- Activated At + 6 Months
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_subscriptions_user_item ON subscriptions(user_id, item_id);
CREATE INDEX idx_subscriptions_expiry ON subscriptions(expires_at, is_active);

-- Videos Table
CREATE TABLE videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    youtube_video_id VARCHAR(100) NOT NULL,     -- YT Video ID for iframe playback
    playlist_name VARCHAR(255),                 -- Playlist classification
    sequence_order INT DEFAULT 0,
    hls_url VARCHAR(512),                       -- Secure HLS play path if non-youtube
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_videos_playlist ON videos(playlist_name);

-- User Watch Progress (Continue Watching)
CREATE TABLE watch_progress (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
    progress_seconds INT DEFAULT 0,
    last_watched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, video_id)
);

-- Video-specific Doubt Chat Messages Table
CREATE TABLE doubt_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_instructor BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_doubt_messages_video ON doubt_messages(video_id);
CREATE INDEX idx_doubt_messages_created ON doubt_messages(created_at ASC);
