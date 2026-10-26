<?php

declare(strict_types=1);

namespace Tests\Support;

use PDO;

final class TestDatabase
{
    public static function create(): PDO
    {
        $pdo = new PDO('sqlite::memory:');
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $pdo->exec(
            'CREATE TABLE users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                "group" TEXT NOT NULL,
                superuser INTEGER NOT NULL DEFAULT 0,
                required_password_reset INTEGER NOT NULL DEFAULT 0,
                created_at TEXT,
                updated_at TEXT
            )',
        );

        $pdo->exec(
            'CREATE TABLE registration_tokens (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL,
                token_hash TEXT NOT NULL UNIQUE,
                expires_at TEXT NOT NULL,
                used_at TEXT NULL,
                created_at TEXT,
                updated_at TEXT
            )',
        );
        $pdo->exec(
            'CREATE TABLE password_reset_tokens (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                token_hash TEXT NOT NULL UNIQUE,
                expires_at TEXT NOT NULL,
                used_at TEXT NULL,
                created_at TEXT,
                updated_at TEXT
            )',
        );
        $pdo->exec(
            'CREATE TABLE frontend_config (
                id TEXT PRIMARY KEY,
                variable_name TEXT UNIQUE NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                value TEXT,
                description TEXT,
                access_group TEXT NOT NULL,
                update_group TEXT NOT NULL,
                label TEXT NOT NULL,
                pattern TEXT NULL,
                placeholder TEXT NULL,
                created_at TEXT,
                updated_at TEXT
            )',
        );
        $pdo->exec(
            'CREATE TABLE orders (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                year INTEGER NOT NULL,
                status TEXT NOT NULL,
                  adults_count INTEGER NOT NULL DEFAULT 0,
                  children_count INTEGER NOT NULL DEFAULT 0,
                  original_text TEXT NULL,
                  current_text TEXT NULL,
                  admin_notes TEXT NULL,
                  fairgate_adults_count INTEGER NULL,
                  fairgate_children_count INTEGER NULL,
                  processing_year INTEGER NULL,
                  released_at TEXT NULL,
                  definitive_at TEXT NULL,
                  fairgate_status TEXT NULL,
                 confirmation_email_sent_at TEXT NULL,
                 fairgate_reminder_email_sent_at TEXT NULL,
                  created_at TEXT,
                updated_at TEXT,
                UNIQUE (user_id, year)
            )',
        );
        $pdo->exec(
            'CREATE TABLE order_items (
                id TEXT PRIMARY KEY,
                order_id TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT \'gift\',
                original_description TEXT NOT NULL,
                current_description TEXT NOT NULL,
                original_reason TEXT NULL,
                 current_reason TEXT NULL,
                 admin_notes TEXT NULL,
                 status TEXT NOT NULL,
                 publication_status TEXT NOT NULL DEFAULT \'draft\',
                 fulfillment_status TEXT NOT NULL DEFAULT \'available\',
                fulfiller_email TEXT NULL,
                reserved_at TEXT NULL,
                due_at TEXT NULL,
                received_at TEXT NULL,
                created_at TEXT,
                updated_at TEXT
            )',
        );
        $pdo->exec(
            'CREATE TABLE order_email_queue (
                id TEXT PRIMARY KEY,
                order_id TEXT NOT NULL,
                email_type TEXT NOT NULL,
                recipient TEXT NOT NULL,
                subject TEXT NOT NULL,
                html_body TEXT NOT NULL,
                text_body TEXT NOT NULL,
                last_error TEXT NULL,
                created_at TEXT,
                updated_at TEXT,
                UNIQUE (order_id, email_type)
            )',
        );
        $pdo->exec(
            'CREATE TABLE rate_limits (
                key_hash TEXT NOT NULL,
                bucket_start TEXT NOT NULL,
                request_count INTEGER NOT NULL DEFAULT 0,
                expires_at TEXT NOT NULL,
                PRIMARY KEY (key_hash, bucket_start)
            )',
        );
        $pdo->exec(
            'CREATE TABLE external_error_logs (
                id TEXT PRIMARY KEY,
                source TEXT NOT NULL,
                operation TEXT NOT NULL,
                message TEXT NOT NULL,
                details TEXT NULL,
                http_status INTEGER NULL,
                order_id TEXT NULL,
                created_at TEXT
            )',
        );
        $pdo->exec(
            'CREATE TABLE events (
                "key" TEXT PRIMARY KEY,
                value INTEGER NOT NULL DEFAULT 0
            )',
        );

        return $pdo;
    }
}
