/**
 * GET /api/store/products
 * Returns all available products/services in the store
 */

exports.handler = async (event, context) => {
  try {
    const products = [
      {
        id: 'consultation-basic',
        name: 'Consulting - Starter',
        type: 'service',
        category: 'Consulting',
        price: 50000, // $500.00 in cents
        pricingModel: 'one-time',
        description: 'Initial consultation to understand your vision and business goals — any industry, any stage.',
        imageUrl: '/assets/images/IMG_1123.PNG',
        features: [
          'One-hour consultation call',
          'Business concept review',
          'Market analysis',
          'Actionable recommendations'
        ]
      },
      {
        id: 'consultation-premium',
        name: 'Consulting - Premium',
        type: 'service',
        category: 'Consulting',
        price: 150000, // $1,500.00 in cents
        pricingModel: 'one-time',
        description: 'Comprehensive consulting package with strategy development and ongoing support, for businesses in any industry.',
        imageUrl: '/assets/images/IMG_1123.PNG',
        features: [
          'Full business audit',
          'Strategic consulting plan',
          'Menu development guidance (food & hospitality clients)',
          'Vendor & partnership sourcing assistance',
          '3 months email support'
        ]
      },
      {
        id: 'media-shoot-half-day',
        name: 'Media Production - Half Day Shoot',
        type: 'service',
        category: 'Media',
        price: 75000, // $750.00 in cents
        pricingModel: 'one-time',
        description: 'Professional photography or videography for 4 hours.',
        imageUrl: '/assets/images/Datamosh-Dream.mp4',
        features: [
          '4-hour on-site shoot',
          'Professional photographer/videographer',
          '50+ edited photos OR 2-minute video',
          'Digital files delivered'
        ]
      },
      {
        id: 'media-shoot-full-day',
        name: 'Media Production - Full Day Shoot',
        type: 'service',
        category: 'Media',
        price: 150000, // $1,500.00 in cents
        pricingModel: 'one-time',
        description: 'Full-day professional media production for your event, brand, or restaurant.',
        imageUrl: '/assets/images/Datamosh-Dream.mp4',
        features: [
          '8-hour shoot coverage',
          'Professional photographer & videographer',
          '100+ edited photos AND 5-minute video',
          'Social media clips included',
          'Digital files delivered'
        ]
      },
      {
        id: 'popup-coordination',
        name: 'Pop-Up Event Coordination',
        type: 'service',
        category: 'Coordination',
        price: 250000, // $2,500.00 in cents
        pricingModel: 'quote',
        description: 'End-to-end coordination for your pop-up event from concept to execution.',
        imageUrl: '/assets/images/food2.mp4',
        features: [
          'Concept development',
          'Menu planning assistance',
          'Vendor coordination',
          'Marketing & promotion',
          'On-site management',
          'Post-event analysis'
        ]
      },
      {
        id: 'web-dev-landing',
        name: 'Web Development - Landing Page',
        type: 'service',
        category: 'Web Development',
        price: 100000, // $1,000.00 in cents
        pricingModel: 'one-time',
        description: 'Professional single-page website showcasing your business — restaurant menus included, but built the same way for any industry.',
        imageUrl: '/assets/images/IMG_0326.JPG',
        features: [
          'Mobile-responsive design',
          'Contact form',
          'Menu & hours display',
          'Social media integration',
          'Gallery/portfolio section',
          'SEO optimized',
          'SSL secured'
        ]
      },
      {
        id: 'web-dev-ecommerce',
        name: 'Web Development - E-Commerce Store',
        type: 'service',
        category: 'Web Development',
        price: 300000, // $3,000.00 in cents
        pricingModel: 'one-time',
        description: 'Full-featured online store for selling products, services, or meals online.',
        imageUrl: '/assets/images/IMG_0326.JPG',
        features: [
          'Product catalog',
          'Shopping cart system',
          'Secure payment processing',
          'Order management',
          'Inventory tracking',
          'Customer accounts',
          'Email notifications',
          'Mobile responsive'
        ]
      },
      {
        id: 'web-dev-custom',
        name: 'Web Development - Custom Project',
        type: 'service',
        category: 'Web Development',
        price: 0, // Custom quote
        pricingModel: 'quote',
        description: 'Custom web development solutions tailored to your specific business needs.',
        imageUrl: '/assets/images/IMG_0326.JPG',
        features: [
          'Custom design',
          'Unique functionality',
          'Integration with existing systems',
          'Advanced features',
          'Scalable architecture',
          'Ongoing support'
        ]
      },
      {
        id: 'branding-package',
        name: 'Branding Package',
        type: 'service',
        category: 'Branding',
        price: 120000, // $1,200.00 in cents
        pricingModel: 'one-time',
        description: 'Logo, color palette, and brand guidelines for your business.',
        imageUrl: '/assets/images/Card.png',
        features: [
          'Logo design (3 revisions)',
          'Color palette',
          'Typography guidelines',
          'Brand voice guide',
          'Social media templates',
          'Digital brand guidelines'
        ]
      },
      {
        id: 'content-strategy',
        name: 'Social Media Content Strategy',
        type: 'service',
        category: 'Strategy',
        price: 80000, // $800.00 in cents
        pricingModel: 'one-time',
        description: '30-day content plan with posting strategy and content themes.',
        imageUrl: '/assets/images/EatMyBalls.png',
        features: [
          '30-day content calendar',
          '15 post concepts',
          'Content themes & messaging',
          'Optimal posting times',
          'Hashtag research',
          'Engagement strategy'
        ]
      }
    ];

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600'
      },
      body: JSON.stringify({
        ok: true,
        products: products
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        error: 'Failed to load products'
      })
    };
  }
};
