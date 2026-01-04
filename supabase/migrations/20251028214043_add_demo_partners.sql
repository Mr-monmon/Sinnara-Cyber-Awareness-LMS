/*
  # إضافة شركاء توضيحيين
  
  1. إضافة شركاء للعرض التوضيحي
    - إضافة 6-8 شعارات شركات سعودية معروفة
    - استخدام placeholder images
*/

-- إضافة شركاء توضيحيين
INSERT INTO homepage_partners (name, logo_url, website_url, order_index, is_active) VALUES
  ('Saudi Aramco', 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=200&h=100&fit=crop', 'https://www.aramco.com', 1, true),
  ('SABIC', 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=200&h=100&fit=crop', 'https://www.sabic.com', 2, true),
  ('stc', 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=200&h=100&fit=crop', 'https://www.stc.com.sa', 3, true),
  ('Saudi Telecom', 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=200&h=100&fit=crop', 'https://www.stc.com.sa', 4, true),
  ('Mobily', 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=200&h=100&fit=crop', 'https://www.mobily.com.sa', 5, true),
  ('Zain KSA', 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=200&h=100&fit=crop', 'https://www.sa.zain.com', 6, true),
  ('Al Rajhi Bank', 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=200&h=100&fit=crop', 'https://www.alrajhibank.com.sa', 7, true),
  ('NCB', 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=200&h=100&fit=crop', 'https://www.alahli.com', 8, true)
ON CONFLICT DO NOTHING;
