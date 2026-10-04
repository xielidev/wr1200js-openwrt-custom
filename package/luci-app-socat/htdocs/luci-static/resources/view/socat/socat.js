'use strict';
'require form';
'require view';
'require fs';
'require uci';
'require tools.widgets as widgets';

return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('socat', _('Socat'),
			_('Socat is a powerful bidirectional data relay tool. Configure port forwarding rules below; each rule listens on the given address/port and forwards all traffic to the target address/port.'));

		s = m.section(form.GridSection, 'socat', _('Forwarding Rules'));
		s.addremove = true;
		s.anonymous = true;
		s.sortable  = true;
		s.cloneable = true;
		s.filterrow = true;

		s.tab('general', _('General Settings'),
			_('A port may be given as a single port or as a range such as 10001-10010. Every port of a range is forwarded separately.'));

		s.sectiontitle = function(section_id) {
			var name = uci.get('socat', section_id, 'name');
			if (name)
				return name;

			var lport = uci.get('socat', section_id, 'listen_port');
			var tip = uci.get('socat', section_id, 'target_ip');
			var tport = uci.get('socat', section_id, 'target_port');

			/* a rule that has not been filled in yet has nothing worth
			 * showing, so fall back to a readable placeholder instead of
			 * the "? -> ?:?" the raw field values would produce */
			if (!lport && !tip && !tport)
				return _('New rule');

			return (lport || '?') + ' \u2192 ' + (tip || '?') + ':' + (tport || '?');
		};

		o = s.option(form.Flag, 'enable', _('Enabled'));
		o.editable = true;
		o.rmempty = false;

		o = s.option(form.DummyValue, '_summary', _('Forwarding'));
		o.textvalue = function(section_id) {
			var proto = uci.get('socat', section_id, 'proto') || 'tcp';
			var tproto = uci.get('socat', section_id, 'target_proto') || proto;
			var listenMode = uci.get('socat', section_id, 'listen_mode') ||
				(uci.get('socat', section_id, 'listen_iface') ? 'iface' :
				(uci.get('socat', section_id, 'listen_ip') ? 'custom' : 'all'));
			var lip = uci.get('socat', section_id, 'listen_ip') || '';
			var lstr = (listenMode === 'wan') ? _('WAN interface') :
				((listenMode === 'iface') ? (uci.get('socat', section_id, 'listen_iface') || '*') :
				((listenMode === 'custom') ? (lip || '*') : '*'));
			var lport = uci.get('socat', section_id, 'listen_port');
			var tip = uci.get('socat', section_id, 'target_ip');
			var tport = uci.get('socat', section_id, 'target_port');
			if (!lport || !tip || !tport)
				return E('small', _('not configured'));
			return E('small', ('%s %s:%s  \u2192  %s %s:%s').format(
				proto.toUpperCase(), lstr, lport,
				tproto.toUpperCase(), tip, tport));
		};

		o = s.taboption('general', form.Value, 'name', _('Name'));
		o.datatype = 'string';
		o.placeholder = _('Unnamed rule');
		o.modalonly = true;

		o = s.taboption('general', form.ListValue, 'proto', _('Protocol'));
		o.value('tcp', 'TCP (IPv4)');
		o.value('tcp6', 'TCP6 (IPv6)');
		o.value('udp', 'UDP (IPv4)');
		o.value('udp6', 'UDP6 (IPv6)');
		o.default = 'tcp';
		o.modalonly = true;

		o = s.taboption('general', form.ListValue, 'target_proto', _('Target protocol'));
		o.value('tcp', 'TCP (IPv4)');
		o.value('tcp6', 'TCP6 (IPv6)');
		o.value('udp', 'UDP (IPv4)');
		o.value('udp6', 'UDP6 (IPv6)');
		o.cfgvalue = function(section_id) {
			return uci.get('socat', section_id, 'target_proto') || uci.get('socat', section_id, 'proto') || 'tcp';
		};
		o.modalonly = true;

		o = s.taboption('general', form.ListValue, 'listen_mode', _('Listen mode'));
		o.value('all', _('All interfaces'));
		o.value('wan', _('WAN interface'));
		o.value('iface', _('Specified interface'));
		o.value('custom', _('Custom address'));
		o.default = 'all';
		o.modalonly = true;

		o = s.taboption('general', form.Value, 'listen_ip', _('Listen address'));
		o.datatype = 'ipaddr';
		o.placeholder = '0.0.0.0';
		o.depends({ 'listen_mode': 'custom' });
		o.modalonly = true;

		o = s.taboption('general', widgets.NetworkSelect, 'listen_iface', _('Interface'));
		o.depends({ 'listen_mode': 'iface' });
		o.modalonly = true;

		o = s.taboption('general', form.Value, 'listen_port', _('Listen port'));
		o.datatype = 'portrange';
		o.placeholder = '10001';
		o.rmempty = false;
		o.modalonly = true;

		o = s.taboption('general', form.Value, 'target_ip', _('Target address'));
		o.datatype = 'ipaddr';
		o.rmempty = false;
		o.modalonly = true;

		o = s.taboption('general', form.Value, 'target_port', _('Target port'));
		o.datatype = 'portrange';
		o.rmempty = false;
		o.modalonly = true;

		o = s.taboption('general', form.Value, 'user', _('Run as user'));
		o.placeholder = 'nobody';
		o.rmempty = true;
		o.modalonly = true;

		return m.render();
	},

	handleSaveApply: function(ev, mode) {
		var Fn = L.bind(function() {
			fs.exec('/etc/init.d/socat', ['restart']);
			document.removeEventListener('uci-applied', Fn);
		});
		document.addEventListener('uci-applied', Fn);
		this.super('handleSaveApply', [ev, mode]);
	}
});