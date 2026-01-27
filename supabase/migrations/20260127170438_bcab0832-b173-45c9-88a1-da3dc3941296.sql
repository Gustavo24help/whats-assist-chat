-- Adicionar 'supervisor' ao enum app_role
-- PostgreSQL permite adicionar valores ao enum de forma segura
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'supervisor';