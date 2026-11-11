/*
  818 — add the Coupons V2 and payment-discount tables to the POS replica publication.
  DRAFT for the owner (as DBA). Run on the PUBLISHER, in the published database. Read every step first.
  Map 793 · ticket .issues/818-the-dba-adds-the-coupons-v2-and-payment-discount-tables-to-the-replica-publication.md

  Step 0 asks one decision: whether the personal-data columns are filtered out of the articles (the semantic
  model never declares them either way). The default below is FILTER, because no personal data should
  leave the publisher for an analytics subscriber.
*/

DECLARE @pub sysname = N'<<PUBLICATION NAME>>';   -- the publication DWPOSREPL03 / POS subscribes to

/* ---------------------------------------------------------------------------------------------------
   Step 0 — check before touching anything.
   immediate_sync = 1 makes the next snapshot cover EVERY article (RetailTrxDetail is about 1.0B rows).
   If it is 1, turn it off first. allow_anonymous has to go off before immediate_sync can.
   That way the snapshot holds only the new articles.
--------------------------------------------------------------------------------------------------- */
SELECT name, immediate_sync, allow_anonymous, status FROM syspublications WHERE name = @pub;
-- EXEC sp_changepublication @publication = @pub, @property = N'allow_anonymous', @value = 'false';
-- EXEC sp_changepublication @publication = @pub, @property = N'immediate_sync',  @value = 'false';

-- Every table must have a primary key (transactional replication refuses a table without one).
SELECT t.name, CASE WHEN EXISTS (SELECT 1 FROM sys.key_constraints k
                                 WHERE k.parent_object_id = t.object_id AND k.type = 'PK')
                    THEN 'PK' ELSE '** NO PK **' END AS pk
FROM sys.tables t
WHERE t.name IN (N'CouponTransaction', N'CouponInstance', N'CouponTemplate',
                 N'PaymentDiscountCampaign', N'PaymentDiscountSwipe', N'PaymentDiscountCampaignBin');

/* ---------------------------------------------------------------------------------------------------
   Step 1 — add the articles. Five required; PaymentDiscountCampaignBin is optional.
--------------------------------------------------------------------------------------------------- */
DECLARE @t TABLE (name sysname, required bit);
INSERT @t VALUES (N'CouponTransaction',1), (N'CouponInstance',1), (N'CouponTemplate',1),
                 (N'PaymentDiscountCampaign',1), (N'PaymentDiscountSwipe',1),
                 (N'PaymentDiscountCampaignBin',0);

DECLARE @name sysname;
DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT name FROM @t;
OPEN c; FETCH NEXT FROM c INTO @name;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sysarticles a JOIN syspublications p ON p.pubid = a.pubid
                   WHERE p.name = @pub AND a.name = @name)
        EXEC sp_addarticle
             @publication       = @pub,
             @article           = @name,
             @source_owner      = N'dbo',
             @source_object     = @name,
             @destination_owner = N'dbo',
             @destination_table = @name,
             @type              = N'logbased',
             @pre_creation_cmd  = N'drop',
             @force_invalidate_snapshot = 1;
    FETCH NEXT FROM c INTO @name;
END
CLOSE c; DEALLOCATE c;

/* ---------------------------------------------------------------------------------------------------
   Step 2 — vertical filter: card digits and the coupon holder stay on the publisher.
--------------------------------------------------------------------------------------------------- */
DECLARE @f TABLE (art sysname, col sysname);
INSERT @f VALUES (N'PaymentDiscountSwipe', N'Bin'),
                 (N'PaymentDiscountSwipe', N'Last'),
                 (N'CouponInstance',       N'CustomerId');
                 -- (N'PaymentDiscountSwipe', N'CashierCode')   -- your call

DECLARE @art sysname, @col sysname;
DECLARE f CURSOR LOCAL FAST_FORWARD FOR SELECT art, col FROM @f;
OPEN f; FETCH NEXT FROM f INTO @art, @col;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF EXISTS (SELECT 1 FROM sysarticles a JOIN syspublications p ON p.pubid = a.pubid
               WHERE p.name = @pub AND a.name = @art)
        EXEC sp_articlecolumn
             @publication = @pub, @article = @art, @column = @col, @operation = N'drop',
             @force_invalidate_snapshot = 1, @force_reinit_subscription = 0;
    FETCH NEXT FROM f INTO @art, @col;
END
CLOSE f; DEALLOCATE f;

/* ---------------------------------------------------------------------------------------------------
   Step 3 — push the new articles to the existing subscription, then snapshot only those.
   sp_refreshsubscriptions covers subscriptions made with @article = 'all'. If DWPOSREPL03's
   subscription is per-article, use sp_addsubscription @article = <each name> instead.
--------------------------------------------------------------------------------------------------- */
EXEC sp_refreshsubscriptions @publication = @pub;
EXEC sp_startpublication_snapshot @publication = @pub;
-- Watch Replication Monitor: the snapshot should list only the new articles.

/* ---------------------------------------------------------------------------------------------------
   Step 4 — the count check. Run it on the PUBLISHER now, and the agent runs it on the subscriber
   (172.23.27.47 / POS) through the sanctioned read-only door. The counts should match within the
   replication lag.
--------------------------------------------------------------------------------------------------- */
SELECT 'CouponTransaction' AS t, COUNT(*) AS n, MAX(RedemptionTime) AS latest FROM CouponTransaction
UNION ALL SELECT 'CouponInstance',          COUNT(*), MAX(CreatedAt) FROM CouponInstance
UNION ALL SELECT 'CouponTemplate',          COUNT(*), MAX(CreatedAt) FROM CouponTemplate
UNION ALL SELECT 'PaymentDiscountCampaign', COUNT(*), MAX(AddedTime) FROM PaymentDiscountCampaign
UNION ALL SELECT 'PaymentDiscountSwipe',    COUNT(*), MAX(SwipedAt)  FROM PaymentDiscountSwipe;
