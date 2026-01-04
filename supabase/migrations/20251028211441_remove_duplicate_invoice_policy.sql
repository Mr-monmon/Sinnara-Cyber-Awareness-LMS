/*
  # إزالة سياسة RLS المكررة
  
  1. المشكلة
    - يوجد سياسة "Platform admins can manage all invoices" بـ cmd=ALL
    - قد تتعارض مع السياسات المفصلة
  
  2. الحل
    - حذف السياسة المكررة
    - الاعتماد على السياسات المفصلة فقط
*/

DROP POLICY IF EXISTS "Platform admins can manage all invoices" ON invoices;
DROP POLICY IF EXISTS "Company admins can view their invoices" ON invoices;
