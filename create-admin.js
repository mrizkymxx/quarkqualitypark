import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gcvnuwfyuyufysopsfxd.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdjdm51d2Z5dXl1Znlzb3BzZnhkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM5MTc3NywiZXhwIjoyMDkyOTY3Nzc3fQ.SfdHdndp7EnQ6hR_1d6uc6Q_r7RIEz4pTUc7jB4QIR4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createSuperUser() {
  console.log('Creating user in Auth...');
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: 'kiki@qqp.com',
    password: 'tamparhiu12',
    email_confirm: true,
    user_metadata: { full_name: 'KIKI' }
  });

  if (authError) {
    console.error('Error creating user:', authError.message);
    return;
  }

  const userId = authData.user.id;
  console.log('User created with ID:', userId);

  console.log('Assigning PPIC role...');
  const { error: roleError } = await supabase
    .from('user_roles')
    .insert([{ user_id: userId, role: 'ppic' }]);

  if (roleError) {
    console.error('Error assigning role:', roleError.message);
    return;
  }

  console.log('Successfully created super user!');
}

createSuperUser();
