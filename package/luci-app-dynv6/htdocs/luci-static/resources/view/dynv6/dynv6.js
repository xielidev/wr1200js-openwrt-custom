'use strict';
'require form';
'require view';
'require fs';
'require uci';
'require ui';
'require tools.widgets as widgets';

return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('dynv6', _('Dynv6 DDNS'),
			_('Publish the IPv6 address of this device to a dynv6 host name, so it stays reachable when the upstream prefix changes.'));

		s = m.section(form.NamedSection, 'main', 'service');
		s.anonymous = true;

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.default = '0';
		o.rmempty = false;

		o = s.option(widgets.NetworkSelect, 'interface', _('Interface'),
			_('Logical interface whose IPv6 address is published.'));
		o.default = 'wan6';
		o.rmempty = false;

		o = s.option(form.Value, 'hostname', _('Host name'),
			_('dynv6 host to update, for example myrouter.dynv6.net'));
		o.datatype = 'hostname';
		o.rmempty = false;

		o = s.option(form.Value, 'token', _('API token'),
			_('HTTP update token of the host above, from the dynv6 web interface.'));
		o.password = true;
		o.rmempty = false;

		o = s.option(form.Button, '_update', _('Update now'));
		o.inputtitle = _('Update now');
		o.inputstyle = 'apply';
		o.onclick = function(ev) {
			ev.preventDefault();

			return fs.exec('/usr/libexec/dynv6-update').then(function(res) {
				var text = ((res.stdout || '') + (res.stderr || '')).trim();
				ui.addNotification(null, E('p', {}, text || _('No output.')), 'info');
			}).catch(function(e) {
				ui.addNotification(null, E('p', {}, e.message), 'error');
			});
		};

		return m.render();
	},

	handleSaveApply: function(ev, mode) {
		var Fn = L.bind(function() {
			fs.exec('/etc/init.d/dynv6', ['restart']);
			document.removeEventListener('uci-applied', Fn);
		});
		document.addEventListener('uci-applied', Fn);
		this.super('handleSaveApply', [ev, mode]);
	}
});