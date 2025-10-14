(function (global) {
  const AlmubdeatSchema = {
    name: 'almubdeat_social_commerce',
    version: 1,
    comment:
      'Normalized schema for the Almubdeat creative marketplace PWA that blends social feeds with commerce primitives.',
    entities: {
      users: {
        name: 'user_account',
        label: 'User Account',
        comment:
          'Authentication primitives for creators and shoppers with social sign-in metadata and device tokens.',
        fields: [
          { name: 'id', type: 'string', primaryKey: true, maxLength: 64 },
          { name: 'role', type: 'string', enum: ['creator', 'buyer', 'admin'], defaultValue: 'creator' },
          { name: 'username', type: 'string', unique: true, maxLength: 32 },
          { name: 'email', type: 'string', nullable: true, maxLength: 120 },
          { name: 'phone', type: 'string', nullable: true, maxLength: 32 },
          { name: 'passwordHash', type: 'string', nullable: true, maxLength: 255 },
          {
            name: 'socialLinks',
            type: 'json',
            comment: 'OAuth provider identifiers (googleId, appleId, instagramHandle, tiktokHandle).'
          },
          {
            name: 'deviceTokens',
            type: 'json',
            comment: 'Array of FCM/APNS tokens used for push notifications and PWA subscriptions.'
          },
          { name: 'status', type: 'string', defaultValue: 'active', enum: ['active', 'suspended', 'pending'] },
          { name: 'createdAt', type: 'timestamp' },
          { name: 'updatedAt', type: 'timestamp' }
        ]
      },
      profiles: {
        name: 'user_profile',
        label: 'User Profile',
        comment:
          'Public facing profile for each creative including biography, showcase media, and storefront preferences.',
        fields: [
          { name: 'id', type: 'string', primaryKey: true, maxLength: 64 },
          { name: 'userId', type: 'string', references: { table: 'user_account', column: 'id', onDelete: 'CASCADE' } },
          { name: 'displayNameAr', type: 'string', maxLength: 96 },
          { name: 'displayNameEn', type: 'string', maxLength: 96 },
          { name: 'bioAr', type: 'text', nullable: true },
          { name: 'bioEn', type: 'text', nullable: true },
          { name: 'avatarUrl', type: 'string', nullable: true },
          { name: 'coverUrl', type: 'string', nullable: true },
          { name: 'city', type: 'string', nullable: true },
          { name: 'country', type: 'string', nullable: true },
          { name: 'rating', type: 'decimal', precision: 3, scale: 2, defaultValue: 4.5 },
          { name: 'reviewCount', type: 'integer', defaultValue: 0 },
          {
            name: 'tags',
            type: 'json',
            comment: 'Array of descriptive keywords used to boost discovery and recommendations.'
          },
          {
            name: 'badges',
            type: 'json',
            comment: 'Earned verification and excellence badges displayed on the storefront.'
          },
          {
            name: 'preferredLanguages',
            type: 'json',
            comment: 'Ordered array of ISO language codes, defaults to ["ar", "en"].'
          },
          {
            name: 'highlightProducts',
            type: 'json',
            comment: 'Pinned product/service ids arranged per creator for quick access in the storefront.'
          },
          { name: 'createdAt', type: 'timestamp' },
          { name: 'updatedAt', type: 'timestamp' }
        ]
      },
      follows: {
        name: 'follow_relation',
        label: 'Follow Relation',
        comment: 'Bidirectional follow graph to power the social feed.',
        fields: [
          { name: 'followerId', type: 'string', references: { table: 'user_account', column: 'id', onDelete: 'CASCADE' } },
          { name: 'followedId', type: 'string', references: { table: 'user_account', column: 'id', onDelete: 'CASCADE' } },
          { name: 'createdAt', type: 'timestamp' }
        ],
        compositePrimaryKey: ['followerId', 'followedId']
      },
      category: {
        name: 'category_node',
        label: 'Category Tree',
        comment:
          'Hierarchical categorisation for services, products, and bundles including marketing copy in Arabic and English.',
        fields: [
          { name: 'id', type: 'string', primaryKey: true, maxLength: 64 },
          { name: 'parentId', type: 'string', nullable: true, references: { table: 'category_node', column: 'id', onDelete: 'SET NULL' } },
          { name: 'kind', type: 'string', enum: ['product', 'service', 'bundle'] },
          { name: 'slug', type: 'string', unique: true, maxLength: 96 },
          { name: 'titleAr', type: 'string', maxLength: 120 },
          { name: 'titleEn', type: 'string', maxLength: 120 },
          { name: 'descriptionAr', type: 'text', nullable: true },
          { name: 'descriptionEn', type: 'text', nullable: true },
          {
            name: 'attributes',
            type: 'json',
            comment: 'Schema-less bag for size, material, dietary info, or fulfilment hints per category.'
          },
          { name: 'sequence', type: 'integer', defaultValue: 0 },
          { name: 'isFeatured', type: 'boolean', defaultValue: false },
          { name: 'createdAt', type: 'timestamp' },
          { name: 'updatedAt', type: 'timestamp' }
        ]
      },
      product: {
        name: 'product_listing',
        label: 'Product Listing',
        comment: 'Catalogue entries for tangible goods crafted by creators.',
        fields: [
          { name: 'id', type: 'string', primaryKey: true, maxLength: 64 },
          { name: 'creatorId', type: 'string', references: { table: 'user_account', column: 'id', onDelete: 'CASCADE' } },
          { name: 'categoryId', type: 'string', references: { table: 'category_node', column: 'id', onDelete: 'RESTRICT' } },
          { name: 'titleAr', type: 'string', maxLength: 140 },
          { name: 'titleEn', type: 'string', maxLength: 140 },
          { name: 'descriptionAr', type: 'text', nullable: true },
          { name: 'descriptionEn', type: 'text', nullable: true },
          { name: 'priceMin', type: 'decimal', precision: 10, scale: 2, nullable: true },
          { name: 'priceMax', type: 'decimal', precision: 10, scale: 2, nullable: true },
          { name: 'currency', type: 'string', maxLength: 3, defaultValue: 'SAR' },
          { name: 'inventoryCount', type: 'integer', defaultValue: 0 },
          { name: 'leadTimeDays', type: 'integer', defaultValue: 3 },
          {
            name: 'mediaGallery',
            type: 'json',
            comment: 'Ordered gallery (images/videos) used in the timeline reels and storefront cards.'
          },
          {
            name: 'options',
            type: 'json',
            comment: 'Selectable options like size, scent, fabric, or personalisation packages.'
          },
          { name: 'status', type: 'string', defaultValue: 'published', enum: ['draft', 'published', 'archived'] },
          { name: 'createdAt', type: 'timestamp' },
          { name: 'updatedAt', type: 'timestamp' }
        ]
      },
      service: {
        name: 'service_listing',
        label: 'Service Listing',
        comment: 'Intangible offerings such as event styling, private workshops, or bespoke baking packages.',
        fields: [
          { name: 'id', type: 'string', primaryKey: true, maxLength: 64 },
          { name: 'creatorId', type: 'string', references: { table: 'user_account', column: 'id', onDelete: 'CASCADE' } },
          { name: 'categoryId', type: 'string', references: { table: 'category_node', column: 'id', onDelete: 'RESTRICT' } },
          { name: 'titleAr', type: 'string', maxLength: 140 },
          { name: 'titleEn', type: 'string', maxLength: 140 },
          { name: 'summaryAr', type: 'text', nullable: true },
          { name: 'summaryEn', type: 'text', nullable: true },
          {
            name: 'packages',
            type: 'json',
            comment: 'List of tiered packages (name, duration, price, perks) to allow structured booking offers.'
          },
          { name: 'serviceArea', type: 'string', nullable: true },
          { name: 'isVirtual', type: 'boolean', defaultValue: false },
          { name: 'responseTimeHours', type: 'integer', defaultValue: 12 },
          { name: 'status', type: 'string', defaultValue: 'published', enum: ['draft', 'published', 'archived'] },
          { name: 'createdAt', type: 'timestamp' },
          { name: 'updatedAt', type: 'timestamp' }
        ]
      },
      post: {
        name: 'timeline_post',
        label: 'Timeline Post',
        comment:
          'Core social object representing either a reel, showcase card, or service announcement that is monetisable.',
        fields: [
          { name: 'id', type: 'string', primaryKey: true, maxLength: 64 },
          { name: 'creatorId', type: 'string', references: { table: 'user_account', column: 'id', onDelete: 'CASCADE' } },
          { name: 'type', type: 'string', enum: ['reel', 'post', 'story'] },
          { name: 'title', type: 'string', maxLength: 180 },
          { name: 'caption', type: 'text', nullable: true },
          { name: 'categoryId', type: 'string', references: { table: 'category_node', column: 'id', onDelete: 'SET NULL' } },
          { name: 'productId', type: 'string', nullable: true, references: { table: 'product_listing', column: 'id', onDelete: 'SET NULL' } },
          { name: 'serviceId', type: 'string', nullable: true, references: { table: 'service_listing', column: 'id', onDelete: 'SET NULL' } },
          {
            name: 'media',
            type: 'json',
            comment: 'Primary media block (videoUrl, coverImage, aspectRatio, durationSeconds).'
          },
          {
            name: 'cta',
            type: 'json',
            comment: 'Call-to-action metadata such as button label, deeplink, whatsapp link, or booking form reference.'
          },
          {
            name: 'pricing',
            type: 'json',
            comment: 'Snapshot of the advertised price range to keep the feed consistent even if catalogue changes later.'
          },
          { name: 'engagement', type: 'json', comment: 'Likes, shares, saves, and impressions counters.' },
          { name: 'publishedAt', type: 'timestamp' },
          { name: 'expiresAt', type: 'timestamp', nullable: true },
          { name: 'visibility', type: 'string', defaultValue: 'public', enum: ['public', 'followers', 'private'] }
        ]
      },
      postTag: {
        name: 'post_tag',
        label: 'Post Tag',
        fields: [
          { name: 'postId', type: 'string', references: { table: 'timeline_post', column: 'id', onDelete: 'CASCADE' } },
          { name: 'tag', type: 'string', maxLength: 48 }
        ],
        compositePrimaryKey: ['postId', 'tag']
      },
      review: {
        name: 'order_review',
        label: 'Order Review',
        comment: 'Post-purchase review object capturing qualitative feedback and rating.',
        fields: [
          { name: 'id', type: 'string', primaryKey: true, maxLength: 64 },
          { name: 'orderId', type: 'string', nullable: true },
          { name: 'buyerId', type: 'string', references: { table: 'user_account', column: 'id', onDelete: 'SET NULL' } },
          { name: 'creatorId', type: 'string', references: { table: 'user_account', column: 'id', onDelete: 'SET NULL' } },
          { name: 'rating', type: 'integer', defaultValue: 5 },
          { name: 'comment', type: 'text', nullable: true },
          {
            name: 'media',
            type: 'json',
            comment: 'Optional user-generated media that appears under the review section of a profile.'
          },
          { name: 'createdAt', type: 'timestamp' }
        ]
      },
      wishlist: {
        name: 'wishlist_item',
        label: 'Wishlist Item',
        comment: 'Links a buyer to a product or service they bookmarked from the social feed.',
        fields: [
          { name: 'id', type: 'string', primaryKey: true, maxLength: 64 },
          { name: 'buyerId', type: 'string', references: { table: 'user_account', column: 'id', onDelete: 'CASCADE' } },
          { name: 'productId', type: 'string', nullable: true, references: { table: 'product_listing', column: 'id', onDelete: 'SET NULL' } },
          { name: 'serviceId', type: 'string', nullable: true, references: { table: 'service_listing', column: 'id', onDelete: 'SET NULL' } },
          { name: 'addedAt', type: 'timestamp' },
          { name: 'notes', type: 'text', nullable: true }
        ]
      }
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AlmubdeatSchema;
  }

  global.AlmubdeatSchema = AlmubdeatSchema;
})(typeof window !== 'undefined' ? window : globalThis);
