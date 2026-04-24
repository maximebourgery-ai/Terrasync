// netlify/functions/find-portal.js
// Trouve le portail client à partir d'un email

const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  // Headers CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // OPTIONS request (CORS preflight)
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Vérifier la méthode
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { email } = JSON.parse(event.body);
    
    if (!email || !email.includes('@')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Email invalide' })
      };
    }

    // Connexion Supabase
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials missing');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Récupérer le workspace
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspace')
      .select('blob')
      .eq('id', 'main')
      .single();

    if (workspaceError || !workspace) {
      throw new Error('Workspace non trouvé');
    }

    const S = JSON.parse(workspace.blob);

    // Chercher l'email dans TOUS les portails
    let foundPortal = null;

    for (const client of S.clients) {
      const users = S.portalUsers?.[client.id] || [];
      const user = users.find(u => 
        u.email?.toLowerCase() === email.toLowerCase() &&
        u.status === 'approved'
      );
      
      if (user) {
        foundPortal = client.id;
        break;
      }
    }

    if (foundPortal) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          portalId: foundPortal,
          message: 'Portail trouvé !'
        })
      };
    } else {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          message: 'Aucun compte trouvé avec cet email'
        })
      };
    }

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Erreur serveur',
        details: error.message
      })
    };
  }
};
