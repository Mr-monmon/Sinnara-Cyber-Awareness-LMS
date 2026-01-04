/*
  # إصلاح سياسات RLS لجدول الفواتير
  
  1. المشكلة
    - سياسات RLS الحالية تمنع Platform Admin من إنشاء فواتير
  
  2. الحل
    - إضافة سياسات كاملة لـ Platform Admin
    - السماح بجميع العمليات (SELECT, INSERT, UPDATE, DELETE)
  
  3. الأمان
    - Platform Admin: صلاحيات كاملة
    - Company Admin: عرض فواتير شركته فقط
    - Employee: لا يمكنه الوصول
*/

-- حذف السياسات القديمة إن وجدت
DROP POLICY IF EXISTS "Platform admins have full access to invoices" ON invoices;
DROP POLICY IF EXISTS "Company admins can view their invoices" ON invoices;
DROP POLICY IF EXISTS "Allow platform admin to insert invoices" ON invoices;
DROP POLICY IF EXISTS "Allow platform admin to update invoices" ON invoices;
DROP POLICY IF EXISTS "Allow platform admin to delete invoices" ON invoices;
DROP POLICY IF EXISTS "Allow platform admin to select invoices" ON invoices;

-- سياسة SELECT: Platform Admin يرى كل شيء، Company Admin يرى فواتير شركته فقط
CREATE POLICY "Platform admins can select all invoices"
  ON invoices
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'PLATFORM_ADMIN'
    )
    OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'COMPANY_ADMIN'
      AND users.company_id = invoices.company_id
    )
  );

-- سياسة INSERT: Platform Admin فقط
CREATE POLICY "Platform admins can insert invoices"
  ON invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'PLATFORM_ADMIN'
    )
  );

-- سياسة UPDATE: Platform Admin فقط
CREATE POLICY "Platform admins can update invoices"
  ON invoices
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'PLATFORM_ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'PLATFORM_ADMIN'
    )
  );

-- سياسة DELETE: Platform Admin فقط
CREATE POLICY "Platform admins can delete invoices"
  ON invoices
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'PLATFORM_ADMIN'
    )
  );
