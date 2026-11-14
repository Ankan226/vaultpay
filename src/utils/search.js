const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');


exports.searchRegex = (q) => {
  const t = String(q || '').trim().slice(0, 100);
  return t ? new RegExp(escapeRegex(t), 'i') : null;
};

exports.parsePaging = (query, defLimit = 10) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defLimit, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
};