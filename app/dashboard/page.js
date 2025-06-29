'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabase/client';
import { useRouter } from 'next/navigation';
import FileUpload from '../components/FileUpload';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('casos-urgentes');
  const [autoData, setAutoData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [classificationFilter, setClassificationFilter] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [dataLoading, setDataLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [userRole, setUserRole] = useState(null);
  const [userAlianza, setUserAlianza] = useState(null);
  const [renovacionesData, setRenovacionesData] = useState([]);
  const [expiringPolicies, setExpiringPolicies] = useState([]);
  const [expiredPolicies, setExpiredPolicies] = useState([]);
  const [renovacionesLoading, setRenovacionesLoading] = useState(false);
  const [columnFilters, setColumnFilters] = useState({
    FECHA: '',
    CREDITO: '',
    CLASIFICACION: '',
    SUCURSAL: '',
    'CLIENTE_CENTRAL 1': '',
    'CLIENTE_CENTRAL 2': '',
    NOMBRE_COMPLETO: '',
    ESTADO: '',
    EMPRESA: '',
    MONEDA: '',
    MODALIDAD: '',
    NUM_VENCI: '',
    TASA_COBRADA: '',
    'FECHA INICIO': '',
    FECHA_FIN: '',
    FECHA_PRIPAGO: '',
    NUMPOLIZA_VID: '',
    FECVENCIPOL_VID: '',
    NUMPOLIZA_AUTO: '',
    FECVENCIPOL_AUTO: '',
    MODALIDAD_SEGURO: '',
    PLAZO_SEGURO: '',
    SERIE: '',
    MARCA_VEHICULAR: '',
    MODELO_VEHICULAR: '',
    VERSION_VEHICULAR: '',
    PRIMA_AUTO_TOTAL: '',
    ASEG_SEGAUTO: '',
    ASEG_SEGVIDA: '',
    PERIODICIDAD: '',
    ASEGURADORA: '',
    CTACHEQ_ASEGURADORA: ''
  });
  const [showColumnFilters, setShowColumnFilters] = useState(false);
  const router = useRouter();

  // Function to determine user role and alianza from email
  const getUserRoleAndAlianza = (email) => {
    if (!email) return { role: null, alianza: null };
    
    // Check if admin
    if (email.includes('admin') || email === 'admin@banorte.com') {
      return { role: 'admin', alianza: null };
    }
    
    // Check for alianza users
    const alianzaMatch = email.match(/alianza(\d+)@/);
    if (alianzaMatch) {
      return { role: 'alianza', alianza: `alianza${alianzaMatch[1]}` };
    }
    
    // Default to admin if no pattern matches
    return { role: 'admin', alianza: null };
  };

  // Fetch auto data from Supabase
  const fetchAutoData = async () => {
    setDataLoading(true);
    try {
      let query = supabase
        .from('auto')
        .select('*')
        .order('FECHA', { ascending: false });

      // Apply role-based filtering
      if (userRole === 'alianza' && userAlianza) {
        // For alianza users, filter by their specific alianza in the CLASIFICACION field
        // Convert alianza2 to "ALIANZA 2" format to match the data
        const alianzaNumber = userAlianza.replace('alianza', '').toUpperCase();
        const alianzaFilter = `ALIANZA ${alianzaNumber}`;
        query = query.eq('CLASIFICACION', alianzaFilter);
      }
      // Admin users see all data, so no additional filter needed

      const { data, error } = await query.limit(1000); // Limit to 1000 records
      
      if (error) throw error;
      
      setAutoData(data || []);
      setFilteredData(data || []);
    } catch (error) {
      console.error('Error fetching auto data:', error);
      setAutoData([]);
      setFilteredData([]);
    } finally {
      setDataLoading(false);
    }
  };

  // Fetch renovaciones data and check for expiring/expired policies
  const fetchRenovacionesData = async () => {
    setRenovacionesLoading(true);
    try {
      const { data, error } = await supabase
        .from('renovaciones')
        .select('*')
        .order('VIGENCIA AUTO', { ascending: true })
        .limit(1000);
      
      if (error) throw error;
      
      setRenovacionesData(data || []);
      
      // Simulated current date: July 19, 2026
      const simulatedToday = new Date('2026-07-19');
      const sevenDaysFromNow = new Date(simulatedToday);
      sevenDaysFromNow.setDate(simulatedToday.getDate() + 7);
      
      const expiring = [];
      const expired = [];
      
      data?.forEach(policy => {
        if (policy['VIGENCIA AUTO']) {
          const expirationDate = new Date(policy['VIGENCIA AUTO']);
          
          // Check if already expired
          if (expirationDate < simulatedToday) {
            expired.push(policy);
          }
          // Check if expiring within 7 days
          else if (expirationDate >= simulatedToday && expirationDate <= sevenDaysFromNow) {
            expiring.push(policy);
          }
        }
      });
      
      setExpiringPolicies(expiring);
      setExpiredPolicies(expired);
      
    } catch (error) {
      console.error('Error fetching renovaciones data:', error);
      setRenovacionesData([]);
      setExpiringPolicies([]);
      setExpiredPolicies([]);
    } finally {
      setRenovacionesLoading(false);
    }
  };

  // Filter data based on search and filters
  useEffect(() => {
    let filtered = autoData;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(item => 
        item.CREDITO?.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.NUMPOLIZA_AUTO?.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.NOMBRE_COMPLETO?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Classification filter
    if (classificationFilter && classificationFilter !== '') {
      filtered = filtered.filter(item => {
        if (classificationFilter === 'SEGUROS BANORTE MANUAL') return item.CLASIFICACION?.includes('MANUAL');
        if (classificationFilter === 'SEGUROS BANORTE MASIVOS') return item.CLASIFICACION?.includes('MASIVOS');
        if (classificationFilter === 'SINIESTROS') return item.CLASIFICACION?.includes('SINIESTROS');
        return true;
      });
    }

    // Date filters
    if (startDateFilter) {
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.FECHA);
        const filterDate = new Date(startDateFilter);
        return itemDate >= filterDate;
      });
    }

    if (endDateFilter) {
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.FECHA);
        const filterDate = new Date(endDateFilter);
        return itemDate <= filterDate;
      });
    }

    // Column-specific filters
    Object.keys(columnFilters).forEach(column => {
      const filterValue = columnFilters[column];
      if (filterValue) {
        filtered = filtered.filter(item => {
          const cellValue = item[column];
          if (cellValue === null || cellValue === undefined) return false;
          return cellValue.toString().toLowerCase().includes(filterValue.toLowerCase());
        });
      }
    });

    // Apply sorting
    if (sortConfig.key) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        
        // Handle null/undefined values
        if (!aVal && !bVal) return 0;
        if (!aVal) return sortConfig.direction === 'asc' ? 1 : -1;
        if (!bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        
        // Convert to appropriate types for comparison
        let aCompare = aVal;
        let bCompare = bVal;
        
        // Handle dates
        if (sortConfig.key === 'FECHA') {
          aCompare = new Date(aVal);
          bCompare = new Date(bVal);
        }
        // Handle numbers
        else if (['CREDITO', 'SUCURSAL', 'CLIENTE_CENTRAL 1', 'CLIENTE_CENTRAL 2', 'EMPRESA', 'MONEDA', 'MODALIDAD', 'FECHA_PRIPAGO', 'NUMPOLIZA_VID', 'NUMPOLIZA_AUTO', 'MODALIDAD_SEGURO', 'PLAZO_SEGURO', 'MODELO_VEHICULAR'].includes(sortConfig.key)) {
          aCompare = parseFloat(aVal) || 0;
          bCompare = parseFloat(bVal) || 0;
        }
        // Handle currency/decimal numbers
        else if (['TASA_COBRADA', 'PRIMA_AUTO_TOTAL', 'ASEG_SEGAUTO', 'ASEG_SEGVIDA'].includes(sortConfig.key)) {
          aCompare = parseFloat(aVal) || 0;
          bCompare = parseFloat(bVal) || 0;
        }
        // Handle strings
        else {
          aCompare = aVal.toString().toLowerCase();
          bCompare = bVal.toString().toLowerCase();
        }
        
        if (aCompare < bCompare) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aCompare > bCompare) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    setFilteredData(filtered);
  }, [autoData, searchTerm, classificationFilter, startDateFilter, endDateFilter, columnFilters, sortConfig]);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        
        // Determine user role and alianza
        const { role, alianza } = getUserRoleAndAlianza(user.email);
        setUserRole(role);
        setUserAlianza(alianza);
        
        // Fetch auto data after user role is determined
        // We'll call fetchAutoData after role is set
      } else {
        router.push('/login');
      }
      setLoading(false);
    };

    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          router.push('/login');
        } else if (session) {
          setUser(session.user);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [router]);

  // Fetch data when user role is determined
  useEffect(() => {
    if (userRole && user) {
      fetchAutoData();
      if (activeSection === 'gestion-polizas') {
        fetchRenovacionesData();
      }
    }
  }, [userRole, userAlianza, activeSection]);

  // Prevent Alianza users from accessing Gestión de Pólizas
  useEffect(() => {
    if (userRole === 'alianza' && activeSection === 'gestion-polizas') {
      setActiveSection('casos-urgentes');
    }
  }, [userRole, activeSection]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const getClassificationBadge = (classification) => {
    if (!classification) return 'bg-gray-100 text-gray-800 border-gray-200';
    
    const badges = {
      'SEGUROS BANORTE MANUAL': 'bg-blue-100 text-blue-800 border-blue-200',
      'SEGUROS BANORTE MASIVOS': 'bg-green-100 text-green-800 border-green-200',
      'SINIESTROS': 'bg-red-100 text-red-800 border-red-200'
    };
    
    // Check if classification contains any of the key terms
    for (const [key, value] of Object.entries(badges)) {
      if (classification.includes(key)) {
        return value;
      }
    }
    
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-ES');
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount) => {
    if (!amount) return '-';
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) return amount;
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(numAmount);
  };

  // Calculate statistics
  const getStatistics = () => {
    const total = filteredData.length;
    const manual = filteredData.filter(item => item.CLASIFICACION?.includes('MANUAL')).length;
    const masivos = filteredData.filter(item => item.CLASIFICACION?.includes('MASIVOS')).length;
    const siniestros = filteredData.filter(item => item.CLASIFICACION?.includes('SINIESTROS')).length;
    const alianza = filteredData.filter(item => item.CLASIFICACION?.toLowerCase().includes('alianza')).length;
    
    return {
      total,
      manual,
      masivos,
      siniestros,
      alianza,
      // Calculate percentages for the chart (still needed for SVG strokeDasharray)
      manualPercent: total > 0 ? Math.round((manual / total) * 100) : 0,
      masivosPercent: total > 0 ? Math.round((masivos / total) * 100) : 0,
      siniestrosPercent: total > 0 ? Math.round((siniestros / total) * 100) : 0,
      alianzaPercent: total > 0 ? Math.round((alianza / total) * 100) : 0
    };
  };

  const stats = getStatistics();

  // Sorting function
  const handleSort = (column) => {
    let direction = 'asc';
    if (sortConfig.key === column && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key: column, direction });
  };

  // Column filter functions
  const handleColumnFilter = (column, value) => {
    setColumnFilters(prev => ({
      ...prev,
      [column]: value
    }));
  };

  const clearAllFilters = () => {
    setColumnFilters({
      FECHA: '',
      CREDITO: '',
      CLASIFICACION: '',
      SUCURSAL: '',
      'CLIENTE_CENTRAL 1': '',
      'CLIENTE_CENTRAL 2': '',
      NOMBRE_COMPLETO: '',
      ESTADO: '',
      EMPRESA: '',
      MONEDA: '',
      MODALIDAD: '',
      NUM_VENCI: '',
      TASA_COBRADA: '',
      'FECHA INICIO': '',
      FECHA_FIN: '',
      FECHA_PRIPAGO: '',
      NUMPOLIZA_VID: '',
      FECVENCIPOL_VID: '',
      NUMPOLIZA_AUTO: '',
      FECVENCIPOL_AUTO: '',
      MODALIDAD_SEGURO: '',
      PLAZO_SEGURO: '',
      SERIE: '',
      MARCA_VEHICULAR: '',
      MODELO_VEHICULAR: '',
      VERSION_VEHICULAR: '',
      PRIMA_AUTO_TOTAL: '',
      ASEG_SEGAUTO: '',
      ASEG_SEGVIDA: '',
      PERIODICIDAD: '',
      ASEGURADORA: '',
      CTACHEQ_ASEGURADORA: ''
    });
    setSearchTerm('');
    setClassificationFilter('');
    setStartDateFilter('');
    setEndDateFilter('');
    setSortConfig({ key: null, direction: 'asc' });
  };

  const getSortIcon = (column) => {
    if (sortConfig.key !== column) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    
    if (sortConfig.direction === 'asc') {
      return (
        <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      );
    }
    
    return (
      <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  // Generate PDF for policy renewal
  const generatePolicyPDF = async (policy) => {
    try {
      // Get additional data from auto table if exists
      const { data: autoData } = await supabase
        .from('auto')
        .select('*')
        .eq('CREDITO', policy.CREDITO)
        .single();

      // Create PDF content
      const pdfContent = {
        policy: policy,
        autoData: autoData,
        generatedDate: new Date().toLocaleDateString('es-ES'),
        simulatedDate: '19/07/2026'
      };

      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Renovación de Póliza - ${policy.CREDITO}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; border-bottom: 2px solid #d32f2f; padding-bottom: 20px; margin-bottom: 30px; }
            .section { margin-bottom: 20px; }
            .label { font-weight: bold; color: #d32f2f; }
            .value { margin-left: 10px; }
            .table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            .table th, .table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            .table th { background-color: #f5f5f5; }
            .status-expired { color: #d32f2f; font-weight: bold; }
            .status-expiring { color: #ff9800; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>BANORTE - Renovación de Póliza</h1>
            <p>Fecha de simulación: ${pdfContent.simulatedDate}</p>
            <p>Fecha de generación: ${pdfContent.generatedDate}</p>
          </div>
          
          <div class="section">
            <h2>Información del Cliente</h2>
            <p><span class="label">Nombre:</span><span class="value">${policy.NOMBRE || 'N/A'}</span></p>
            <p><span class="label">Crédito:</span><span class="value">${policy.CREDITO}</span></p>
            <p><span class="label">Oficina:</span><span class="value">${policy.Oficina || 'N/A'}</span></p>
          </div>
          
          <div class="section">
            <h2>Información de la Póliza</h2>
            <p><span class="label">No. Póliza Auto:</span><span class="value">${policy['NO. POLIZA AUTO'] || 'N/A'}</span></p>
            <p><span class="label">No. Póliza Vida:</span><span class="value">${policy['NO. POLIZA VIDA'] || 'N/A'}</span></p>
            <p><span class="label">Serie:</span><span class="value">${policy.SERIE || 'N/A'}</span></p>
            <p><span class="label">Plan:</span><span class="value">${policy.PLAN || 'N/A'}</span></p>
          </div>
          
          <div class="section">
            <h2>Vigencias</h2>
            <p><span class="label">Vigencia Auto:</span><span class="value">${policy['VIGENCIA AUTO'] || 'N/A'}</span></p>
            <p><span class="label">Vigencia Vida:</span><span class="value">${policy['VIGENCIA VIDA'] || 'N/A'}</span></p>
          </div>
          
          <div class="section">
            <h2>Costos</h2>
            <p><span class="label">Costo Auto:</span><span class="value">$${policy['COSTO AUTO']?.toLocaleString('es-MX') || '0'}</span></p>
            <p><span class="label">Costo Vida:</span><span class="value">$${policy['COSTO VIDA']?.toLocaleString('es-MX') || '0'}</span></p>
            <p><span class="label">Total:</span><span class="value">$${policy.TOTAL?.toLocaleString('es-MX') || '0'}</span></p>
          </div>
          
          ${autoData ? `
          <div class="section">
            <h2>Información Adicional del Vehículo</h2>
            <p><span class="label">Marca:</span><span class="value">${autoData.MARCA_VEHICULAR || 'N/A'}</span></p>
            <p><span class="label">Modelo:</span><span class="value">${autoData.MODELO_VEHICULAR || 'N/A'}</span></p>
            <p><span class="label">Versión:</span><span class="value">${autoData.VERSION_VEHICULAR || 'N/A'}</span></p>
            <p><span class="label">Estado:</span><span class="value">${autoData.ESTADO || 'N/A'}</span></p>
          </div>
          ` : ''}
          
          <div class="section">
            <p style="text-align: center; margin-top: 50px; font-size: 12px; color: #666;">
              Este documento fue generado automáticamente por el Sistema Institucional Banorte
            </p>
          </div>
          
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              }
            }
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error al generar el PDF');
    }
  };

  // Get unique values for column filters
  const getUniqueValues = (column) => {
    const values = autoData
      .map(item => item[column])
      .filter(value => value !== null && value !== undefined && value !== '')
      .map(value => value.toString());
    return [...new Set(values)].sort();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-red-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg">
        {/* Header */}
        <div className="px-6 py-4 bg-red-600">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-white font-bold text-lg">Banorte</h1>
              <p className="text-red-100 text-xs">Sistema Institucional</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="mt-6">
          <div className="px-4">
            <button
              onClick={() => setActiveSection('casos-urgentes')}
              className={`w-full flex items-center px-4 py-3 text-left rounded-lg mb-2 ${
                activeSection === 'casos-urgentes' 
                  ? 'bg-red-50 text-red-700 border-l-4 border-red-500' 
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <svg className="w-5 h-5 mr-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              Casos Urgentes
            </button>

            {/* Only show Gestión de Pólizas for admin users */}
            {userRole === 'admin' && (
              <button
                onClick={() => setActiveSection('gestion-polizas')}
                className={`w-full flex items-center px-4 py-3 text-left rounded-lg mb-2 ${
                  activeSection === 'gestion-polizas' 
                    ? 'bg-red-50 text-red-700 border-l-4 border-red-500' 
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <svg className="w-5 h-5 mr-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Gestión de Pólizas
              </button>
            )}

            <button
              onClick={() => setActiveSection('carga-datos')}
              className={`w-full flex items-center px-4 py-3 text-left rounded-lg mb-2 ${
                activeSection === 'carga-datos' 
                  ? 'bg-red-50 text-red-700 border-l-4 border-red-500' 
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <svg className="w-5 h-5 mr-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Carga de Datos
            </button>

            {/* <button
              onClick={() => setActiveSection('comunicacion')}
              className={`w-full flex items-center px-4 py-3 text-left rounded-lg mb-2 ${
                activeSection === 'comunicacion' 
                  ? 'bg-red-50 text-red-700 border-l-4 border-red-500' 
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <svg className="w-5 h-5 mr-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Comunicación
            </button> */}
          </div>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="px-6 py-4 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Casos Urgentes</h1>
              <p className="text-sm text-gray-600">Gestión y seguimiento de casos prioritarios</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <span className="text-sm text-gray-600">Bienvenido, </span>
                <span className="text-sm font-medium text-gray-900">
                  {userRole === 'admin' ? 'Administrador' : userAlianza?.toUpperCase() || 'Usuario'}
                </span>
                <div className="text-xs text-gray-500">{user?.email}</div>
                {userRole === 'admin' && (
                  <div className="text-xs text-green-600 font-medium">Acceso completo a todos los datos</div>
                )}
                {userRole === 'alianza' && (
                  <div className="text-xs text-blue-600 font-medium">Datos de {userAlianza?.toUpperCase()}</div>
                )}
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center space-x-2 text-red-600 hover:text-red-700"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="text-sm">Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-6">
          <div className={`grid grid-cols-1 gap-6 ${userRole === 'admin' ? 'lg:grid-cols-4' : 'lg:grid-cols-1'}`}>
            {/* Main Content Section */}
            <div className={userRole === 'admin' ? 'lg:col-span-3' : 'lg:col-span-1'}>
              {/* Casos Urgentes Section */}
              {activeSection === 'casos-urgentes' && (
                <div className="bg-white rounded-lg shadow">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Lista de Casos Urgentes</h3>
                  <div className="mt-4 flex flex-wrap gap-4">
                    <div className="flex-1 min-w-64">
                      <input
                        type="text"
                        placeholder="Buscar crédito, póliza, cliente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                      />
                    </div>
                    <select 
                      value={classificationFilter}
                      onChange={(e) => setClassificationFilter(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                    >
                      <option value="">Todas las clasificaciones</option>
                      <option value="SEGUROS BANORTE MANUAL">Seguros Banorte Manual</option>
                      <option value="SEGUROS BANORTE MASIVOS">Seguros Banorte Masivos</option>
                      <option value="SINIESTROS">Siniestros</option>
                    </select>
                    <input
                      type="date"
                      value={startDateFilter}
                      onChange={(e) => setStartDateFilter(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                      placeholder="Fecha inicio"
                    />
                    <input
                      type="date"
                      value={endDateFilter}
                      onChange={(e) => setEndDateFilter(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                      placeholder="Fecha fin"
                    />
                    <button
                      onClick={fetchAutoData}
                      disabled={dataLoading}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>{dataLoading ? 'Actualizando...' : 'Actualizar'}</span>
                    </button>
                    <button
                      onClick={() => setShowColumnFilters(!showColumnFilters)}
                      className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 flex items-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                      </svg>
                      <span>Filtros Avanzados</span>
                    </button>
                    <button
                      onClick={clearAllFilters}
                      className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 flex items-center space-x-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>Limpiar</span>
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-sm text-gray-600">
                      Mostrando {filteredData.length} de {autoData.length} casos
                    </p>
                    {dataLoading && (
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
                        <span>Cargando datos...</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="overflow-x-auto">
                    {/* Advanced Column Filters */}
                    {showColumnFilters && (
                      <div className="mb-4 p-4 bg-gray-50 rounded-lg border">
                        <h4 className="text-sm font-medium text-gray-700 mb-3">Filtros por Columna</h4>
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 max-h-96 overflow-y-auto">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
                            <input
                              type="text"
                              placeholder="Filtrar fecha..."
                              value={columnFilters.FECHA}
                              onChange={(e) => handleColumnFilter('FECHA', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Crédito</label>
                            <input
                              type="text"
                              placeholder="Filtrar crédito..."
                              value={columnFilters.CREDITO}
                              onChange={(e) => handleColumnFilter('CREDITO', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Clasificación</label>
                            <select
                              value={columnFilters.CLASIFICACION}
                              onChange={(e) => handleColumnFilter('CLASIFICACION', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                            >
                              <option value="">Todas</option>
                              {getUniqueValues('CLASIFICACION').map(value => (
                                <option key={value} value={value}>{value}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Sucursal</label>
                            <input
                              type="text"
                              placeholder="Filtrar sucursal..."
                              value={columnFilters.SUCURSAL}
                              onChange={(e) => handleColumnFilter('SUCURSAL', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Cliente Central 1</label>
                            <input
                              type="text"
                              placeholder="Filtrar cliente 1..."
                              value={columnFilters['CLIENTE_CENTRAL 1']}
                              onChange={(e) => handleColumnFilter('CLIENTE_CENTRAL 1', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Cliente Central 2</label>
                            <input
                              type="text"
                              placeholder="Filtrar cliente 2..."
                              value={columnFilters['CLIENTE_CENTRAL 2']}
                              onChange={(e) => handleColumnFilter('CLIENTE_CENTRAL 2', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Nombre Completo</label>
                            <input
                              type="text"
                              placeholder="Filtrar nombre..."
                              value={columnFilters.NOMBRE_COMPLETO}
                              onChange={(e) => handleColumnFilter('NOMBRE_COMPLETO', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
                            <select
                              value={columnFilters.ESTADO}
                              onChange={(e) => handleColumnFilter('ESTADO', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                            >
                              <option value="">Todos</option>
                              {getUniqueValues('ESTADO').map(value => (
                                <option key={value} value={value}>{value}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Tasa Cobrada</label>
                            <input
                              type="text"
                              placeholder="Filtrar tasa..."
                              value={columnFilters.TASA_COBRADA}
                              onChange={(e) => handleColumnFilter('TASA_COBRADA', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Fecha Inicio</label>
                            <input
                              type="text"
                              placeholder="Filtrar fecha inicio..."
                              value={columnFilters['FECHA INICIO']}
                              onChange={(e) => handleColumnFilter('FECHA INICIO', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Fecha Fin</label>
                            <input
                              type="text"
                              placeholder="Filtrar fecha fin..."
                              value={columnFilters.FECHA_FIN}
                              onChange={(e) => handleColumnFilter('FECHA_FIN', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Póliza Vida</label>
                            <input
                              type="text"
                              placeholder="Filtrar póliza vida..."
                              value={columnFilters.NUMPOLIZA_VID}
                              onChange={(e) => handleColumnFilter('NUMPOLIZA_VID', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Póliza Auto</label>
                            <input
                              type="text"
                              placeholder="Filtrar póliza auto..."
                              value={columnFilters.NUMPOLIZA_AUTO}
                              onChange={(e) => handleColumnFilter('NUMPOLIZA_AUTO', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Serie</label>
                            <input
                              type="text"
                              placeholder="Filtrar serie..."
                              value={columnFilters.SERIE}
                              onChange={(e) => handleColumnFilter('SERIE', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Marca</label>
                            <select
                              value={columnFilters.MARCA_VEHICULAR}
                              onChange={(e) => handleColumnFilter('MARCA_VEHICULAR', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                            >
                              <option value="">Todas</option>
                              {getUniqueValues('MARCA_VEHICULAR').map(value => (
                                <option key={value} value={value}>{value}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Modelo</label>
                            <input
                              type="text"
                              placeholder="Filtrar modelo..."
                              value={columnFilters.MODELO_VEHICULAR}
                              onChange={(e) => handleColumnFilter('MODELO_VEHICULAR', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Versión</label>
                            <input
                              type="text"
                              placeholder="Filtrar versión..."
                              value={columnFilters.VERSION_VEHICULAR}
                              onChange={(e) => handleColumnFilter('VERSION_VEHICULAR', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Prima Total</label>
                            <input
                              type="text"
                              placeholder="Filtrar prima..."
                              value={columnFilters.PRIMA_AUTO_TOTAL}
                              onChange={(e) => handleColumnFilter('PRIMA_AUTO_TOTAL', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Aseg. Auto</label>
                            <input
                              type="text"
                              placeholder="Filtrar aseg auto..."
                              value={columnFilters.ASEG_SEGAUTO}
                              onChange={(e) => handleColumnFilter('ASEG_SEGAUTO', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Aseg. Vida</label>
                            <input
                              type="text"
                              placeholder="Filtrar aseg vida..."
                              value={columnFilters.ASEG_SEGVIDA}
                              onChange={(e) => handleColumnFilter('ASEG_SEGVIDA', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Periodicidad</label>
                            <select
                              value={columnFilters.PERIODICIDAD}
                              onChange={(e) => handleColumnFilter('PERIODICIDAD', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                            >
                              <option value="">Todas</option>
                              {getUniqueValues('PERIODICIDAD').map(value => (
                                <option key={value} value={value}>{value}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Aseguradora</label>
                            <input
                              type="text"
                              placeholder="Filtrar aseguradora..."
                              value={columnFilters.ASEGURADORA}
                              onChange={(e) => handleColumnFilter('ASEGURADORA', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th 
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort('FECHA')}
                          >
                            <div className="flex items-center space-x-1">
                              <span>Fecha</span>
                              {getSortIcon('FECHA')}
                            </div>
                          </th>
                          <th 
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort('CREDITO')}
                          >
                            <div className="flex items-center space-x-1">
                              <span>Crédito</span>
                              {getSortIcon('CREDITO')}
                            </div>
                          </th>
                          <th 
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort('CLASIFICACION')}
                          >
                            <div className="flex items-center space-x-1">
                              <span>Clasificación</span>
                              {getSortIcon('CLASIFICACION')}
                            </div>
                          </th>
                          <th 
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort('SUCURSAL')}
                          >
                            <div className="flex items-center space-x-1">
                              <span>Sucursal</span>
                              {getSortIcon('SUCURSAL')}
                            </div>
                          </th>
                          <th 
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort('NOMBRE_COMPLETO')}
                          >
                            <div className="flex items-center space-x-1">
                              <span>Cliente</span>
                              {getSortIcon('NOMBRE_COMPLETO')}
                            </div>
                          </th>
                          <th 
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort('ESTADO')}
                          >
                            <div className="flex items-center space-x-1">
                              <span>Estado</span>
                              {getSortIcon('ESTADO')}
                            </div>
                          </th>
                          <th 
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort('TASA_COBRADA')}
                          >
                            <div className="flex items-center space-x-1">
                              <span>Tasa %</span>
                              {getSortIcon('TASA_COBRADA')}
                            </div>
                          </th>
                          <th 
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort('FECHA INICIO')}
                          >
                            <div className="flex items-center space-x-1">
                              <span>F. Inicio</span>
                              {getSortIcon('FECHA INICIO')}
                            </div>
                          </th>
                          <th 
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort('FECHA_FIN')}
                          >
                            <div className="flex items-center space-x-1">
                              <span>F. Fin</span>
                              {getSortIcon('FECHA_FIN')}
                            </div>
                          </th>
                          <th 
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort('NUMPOLIZA_VID')}
                          >
                            <div className="flex items-center space-x-1">
                              <span>Póliza Vida</span>
                              {getSortIcon('NUMPOLIZA_VID')}
                            </div>
                          </th>
                          <th 
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort('NUMPOLIZA_AUTO')}
                          >
                            <div className="flex items-center space-x-1">
                              <span>Póliza Auto</span>
                              {getSortIcon('NUMPOLIZA_AUTO')}
                            </div>
                          </th>
                          <th 
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort('SERIE')}
                          >
                            <div className="flex items-center space-x-1">
                              <span>Serie</span>
                              {getSortIcon('SERIE')}
                            </div>
                          </th>
                          <th 
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort('MARCA_VEHICULAR')}
                          >
                            <div className="flex items-center space-x-1">
                              <span>Vehículo</span>
                              {getSortIcon('MARCA_VEHICULAR')}
                            </div>
                          </th>
                          <th 
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort('PRIMA_AUTO_TOTAL')}
                          >
                            <div className="flex items-center space-x-1">
                              <span>Prima Total</span>
                              {getSortIcon('PRIMA_AUTO_TOTAL')}
                            </div>
                          </th>
                          <th 
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort('ASEG_SEGAUTO')}
                          >
                            <div className="flex items-center space-x-1">
                              <span>Aseg. Auto</span>
                              {getSortIcon('ASEG_SEGAUTO')}
                            </div>
                          </th>
                          <th 
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort('ASEG_SEGVIDA')}
                          >
                            <div className="flex items-center space-x-1">
                              <span>Aseg. Vida</span>
                              {getSortIcon('ASEG_SEGVIDA')}
                            </div>
                          </th>
                          <th 
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort('PERIODICIDAD')}
                          >
                            <div className="flex items-center space-x-1">
                              <span>Periodicidad</span>
                              {getSortIcon('PERIODICIDAD')}
                            </div>
                          </th>
                          <th 
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort('ASEGURADORA')}
                          >
                            <div className="flex items-center space-x-1">
                              <span>Aseguradora</span>
                              {getSortIcon('ASEGURADORA')}
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredData.length === 0 ? (
                          <tr>
                            <td colSpan="18" className="px-6 py-8 text-center text-gray-500">
                              {dataLoading ? 'Cargando datos...' : 'No se encontraron casos'}
                            </td>
                          </tr>
                        ) : (
                          filteredData.map((item, index) => (
                            <tr key={item.CREDITO || index} className="hover:bg-gray-50">
                              <td className="px-4 py-4 whitespace-nowrap text-xs text-gray-900">
                                {formatDate(item.FECHA)}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-xs font-medium text-gray-900">
                                {item.CREDITO}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getClassificationBadge(item.CLASIFICACION)}`}>
                                  {item.CLASIFICACION?.replace('SEGUROS BANORTE ', '') || '-'}
                                </span>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-xs text-gray-900">
                                {item.SUCURSAL || '-'}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-xs text-gray-900 max-w-xs truncate" title={item.NOMBRE_COMPLETO}>
                                {item.NOMBRE_COMPLETO || '-'}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-xs text-gray-900">
                                {item.ESTADO || '-'}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-xs text-gray-900">
                                {item.TASA_COBRADA ? `${item.TASA_COBRADA}%` : '-'}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-xs text-gray-900">
                                {formatDate(item['FECHA INICIO'])}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-xs text-gray-900">
                                {formatDate(item.FECHA_FIN)}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-xs text-gray-900">
                                {item.NUMPOLIZA_VID || '-'}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-xs text-gray-900">
                                {item.NUMPOLIZA_AUTO || '-'}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-xs text-gray-900 max-w-xs truncate" title={item.SERIE}>
                                {item.SERIE || '-'}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-xs text-gray-900">
                                <div className="max-w-xs">
                                  <div className="font-medium">{item.MARCA_VEHICULAR} {item.MODELO_VEHICULAR}</div>
                                  <div className="text-xs text-gray-500">{item.VERSION_VEHICULAR}</div>
                                </div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-xs text-gray-900">
                                {formatCurrency(item.PRIMA_AUTO_TOTAL)}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-xs text-gray-900">
                                {formatCurrency(item.ASEG_SEGAUTO)}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-xs text-gray-900">
                                {formatCurrency(item.ASEG_SEGVIDA)}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-xs text-gray-900">
                                {item.PERIODICIDAD || '-'}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-xs text-gray-900">
                                {item.ASEGURADORA || '-'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              )}

              {/* Carga de Datos Section */}
              {activeSection === 'carga-datos' && (
                <FileUpload 
                  userRole={userRole} 
                  userAlianza={userAlianza} 
                  onUploadSuccess={fetchAutoData}
                />
              )}

              {/* Gestión de Pólizas Section */}
              {activeSection === 'gestion-polizas' && (
                <div className="space-y-6">
                  {/* Simulation Notice */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-blue-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <h4 className="text-sm font-medium text-blue-900">Ambiente de Simulación</h4>
                        <p className="text-sm text-blue-700">Fecha simulada actual: <strong>19 de Julio, 2026</strong></p>
                      </div>
                    </div>
                  </div>

                  {/* Controls */}
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-medium text-gray-900">Gestión de Pólizas - Seguimiento de Vencimientos</h3>
                      <button
                        onClick={fetchRenovacionesData}
                        disabled={renovacionesLoading}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center space-x-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>{renovacionesLoading ? 'Actualizando...' : 'Actualizar'}</span>
                      </button>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-center">
                          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="ml-3">
                            <p className="text-sm font-medium text-red-900">Pólizas Vencidas</p>
                            <p className="text-2xl font-bold text-red-900">{expiredPolicies.length}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex items-center">
                          <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                          <div className="ml-3">
                            <p className="text-sm font-medium text-amber-900">Por Vencer (7 días)</p>
                            <p className="text-2xl font-bold text-amber-900">{expiringPolicies.length}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center">
                          <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="ml-3">
                            <p className="text-sm font-medium text-green-900">Total Pólizas</p>
                            <p className="text-2xl font-bold text-green-900">{renovacionesData.length}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expired Policies Table */}
                    {expiredPolicies.length > 0 && (
                      <div className="mb-8">
                        <h4 className="text-lg font-medium text-red-900 mb-4 flex items-center">
                          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Pólizas Vencidas ({expiredPolicies.length})
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-red-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-red-900 uppercase tracking-wider">Crédito</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-red-900 uppercase tracking-wider">Cliente</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-red-900 uppercase tracking-wider">Póliza Auto</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-red-900 uppercase tracking-wider">Vigencia Auto</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-red-900 uppercase tracking-wider">Días Vencida</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-red-900 uppercase tracking-wider">Total</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-red-900 uppercase tracking-wider">Acción</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {expiredPolicies.map((policy, index) => {
                                const daysExpired = Math.floor((new Date('2026-07-19') - new Date(policy['VIGENCIA AUTO'])) / (1000 * 60 * 60 * 24));
                                return (
                                  <tr key={policy.CREDITO} className="hover:bg-red-50">
                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{policy.CREDITO}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{policy.NOMBRE}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{policy['NO. POLIZA AUTO']}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-red-600 font-medium">{policy['VIGENCIA AUTO']}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-red-600 font-bold">{daysExpired} días</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${policy.TOTAL?.toLocaleString('es-MX')}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                      <button
                                        onClick={() => generatePolicyPDF(policy)}
                                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs font-medium flex items-center space-x-1"
                                      >
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <span>Renovar</span>
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Expiring Policies Table */}
                    {expiringPolicies.length > 0 && (
                      <div className="mb-8">
                        <h4 className="text-lg font-medium text-amber-900 mb-4 flex items-center">
                          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                          Pólizas por Vencer en los Próximos 7 Días ({expiringPolicies.length})
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-amber-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-amber-900 uppercase tracking-wider">Crédito</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-amber-900 uppercase tracking-wider">Cliente</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-amber-900 uppercase tracking-wider">Póliza Auto</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-amber-900 uppercase tracking-wider">Vigencia Auto</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-amber-900 uppercase tracking-wider">Días Restantes</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-amber-900 uppercase tracking-wider">Total</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-amber-900 uppercase tracking-wider">Acción</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {expiringPolicies.map((policy, index) => {
                                const daysRemaining = Math.ceil((new Date(policy['VIGENCIA AUTO']) - new Date('2026-07-19')) / (1000 * 60 * 60 * 24));
                                return (
                                  <tr key={policy.CREDITO} className="hover:bg-amber-50">
                                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{policy.CREDITO}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{policy.NOMBRE}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{policy['NO. POLIZA AUTO']}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-amber-600 font-medium">{policy['VIGENCIA AUTO']}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-amber-600 font-bold">{daysRemaining} días</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">${policy.TOTAL?.toLocaleString('es-MX')}</td>
                                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                                      <button
                                        onClick={() => generatePolicyPDF(policy)}
                                        className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded text-xs font-medium flex items-center space-x-1"
                                      >
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <span>Renovar</span>
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Loading State */}
                    {renovacionesLoading && (
                      <div className="flex justify-center items-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
                        <span className="ml-2 text-gray-600">Cargando pólizas...</span>
                      </div>
                    )}

                    {/* No Data State */}
                    {!renovacionesLoading && renovacionesData.length === 0 && (
                      <div className="text-center py-8">
                        <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-gray-600">No se encontraron pólizas</p>
                      </div>
                    )}

                    {/* Success State */}
                    {!renovacionesLoading && renovacionesData.length > 0 && expiredPolicies.length === 0 && expiringPolicies.length === 0 && (
                      <div className="text-center py-8">
                        <svg className="w-12 h-12 text-green-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">¡Todas las pólizas están al día!</h3>
                        <p className="text-gray-600">No hay pólizas vencidas o por vencer en los próximos 7 días</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Comunicación Section */}
              {activeSection === 'comunicacion' && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Comunicación</h3>
                  <p className="text-gray-600">Módulo de comunicación en desarrollo...</p>
                </div>
              )}
            </div>

            {/* Chart Section - Only for Admin Users */}
            {userRole === 'admin' && (
              <div className="lg:col-span-1">
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Estado de Casos</h3>
                
                {/* Donut Chart */}
                <div className="relative w-40 h-40 mx-auto mb-6">
                  <svg className="w-40 h-40 transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#fee2e2"
                      strokeWidth="3"
                    />
                    {/* Manual */}
                    <path
                      d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="3"
                      strokeDasharray={`${stats.manualPercent}, 100`}
                    />
                    {/* Masivos */}
                    <path
                      d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="3"
                      strokeDasharray={`${stats.masivosPercent}, 100`}
                      strokeDashoffset={`-${stats.manualPercent}`}
                    />
                    {/* Siniestros */}
                    <path
                      d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="3"
                      strokeDasharray={`${stats.siniestrosPercent}, 100`}
                      strokeDashoffset={`-${stats.manualPercent + stats.masivosPercent}`}
                    />
                    {/* Alianza */}
                    <path
                      d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="3"
                      strokeDasharray={`${stats.alianzaPercent}, 100`}
                      strokeDashoffset={`-${stats.manualPercent + stats.masivosPercent + stats.siniestrosPercent}`}
                    />
                  </svg>
                </div>

                {/* Legend */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                      <span className="text-sm text-gray-700">Manual</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">{stats.manual} casos</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                      <span className="text-sm text-gray-700">Masivos</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">{stats.masivos} casos</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                      <span className="text-sm text-gray-700">Siniestros</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">{stats.siniestros} casos</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-amber-500 rounded-full mr-2"></div>
                      <span className="text-sm text-gray-700">Alianza</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">{stats.alianza} casos</span>
                  </div>
                  <div className="pt-2 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Total casos</span>
                      <span className="text-sm font-bold text-gray-900">{stats.total}</span>
                    </div>
                  </div>
                </div>
              </div>
              </div>
            )}
            </div>
            </main>
      </div>
    </div>
  );
}
