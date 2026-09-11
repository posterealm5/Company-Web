import React from 'react';
import { Link } from 'react-router-dom';
import { SEO } from '../components/SEO';
import { getStaticPageMetadata } from '../services/metadata';
import { motion } from 'motion/react';
import { ArrowLeft, Shield, User, FileText, CreditCard, Cookie, Image, Mail, Phone, CheckCircle2, Copy } from 'lucide-react';
import { useCart } from '../context/CartContext';

export default function PrivacyPolicy() {
  const { triggerNotification } = useCart();

  const handleCopyEmail = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    const email = 'posterealm5@gmail.com';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(email);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = email;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
      } catch (err) {
        console.error('Failed to copy text: ', err);
      }
      document.body.removeChild(textarea);
    }
    triggerNotification('Email copied successfully');
  };


  const sections = [
    {
      id: 'introduction',
      title: 'Introduction',
      icon: <Shield className="text-brand-red" size={24} />,
      content: (
        <p className="text-gray-700 dark:text-zinc-300 leading-relaxed font-medium">
          At Posterealm, we value your privacy and are committed to protecting your personal information. This policy outlines how we handle the data you share with us.
        </p>
      )
    },
    {
      id: 'information-we-collect',
      title: 'Information We Collect',
      icon: <User className="text-brand-red" size={24} />,
      content: (
        <div className="space-y-2 text-gray-700 dark:text-zinc-300 font-medium">
          <p className="mb-3">We collect the following information when you interact with our website or place an order:</p>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              'Name',
              'Email address',
              'Phone number',
              'Shipping and billing address',
              'Order details',
              'Uploaded custom design files',
              'Device and browser information'
            ].map((item, idx) => (
              <li key={idx} className="flex items-center gap-2 bg-brand-white dark:bg-zinc-800 p-2 comic-border border-brand-black dark:border-zinc-700 border-2 shadow-none text-sm text-brand-black dark:text-zinc-200">
                <CheckCircle2 size={16} className="text-brand-red shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )
    },
    {
      id: 'how-we-use-your-information',
      title: 'How We Use Your Information',
      icon: <FileText className="text-brand-red" size={24} />,
      content: (
        <div className="space-y-4 text-gray-700 dark:text-zinc-300 font-medium">
          <p>We use your information to:</p>
          <ul className="list-disc pl-5 space-y-2 text-sm">
            <li>Process and fulfill orders</li>
            <li>Coordinate shipping and local delivery services</li>
            <li>Send essential order updates, notifications, and verification links</li>
            <li>Improve our website, product catalog, and customer experience</li>
            <li>Prevent fraud and maintain platform security</li>
          </ul>
        </div>
      )
    },
    {
      id: 'payment-processing',
      title: 'Payment Processing',
      icon: <CreditCard className="text-brand-red" size={24} />,
      content: (
        <div className="space-y-3 text-gray-700 dark:text-zinc-300 font-medium">
          <p>
            Online payments on Posterealm are securely handled by <strong className="text-brand-black dark:text-zinc-100 font-bold">Razorpay</strong>.
          </p>
          <p>
            We do not store complete card numbers, CVVs, or UPI PINs on our servers. All sensitive financial transactions are processed securely through Razorpay’s encrypted gateway compliant with RBI standards.
          </p>
        </div>
      )
    },
    {
      id: 'cookies-and-tracking',
      title: 'Cookies and Tracking',
      icon: <Cookie className="text-brand-red" size={24} />,
      content: (
        <div className="space-y-3 text-gray-700 dark:text-zinc-300 font-medium">
          <p>We use local storage and essential session identifiers to:</p>
          <ul className="list-disc pl-5 space-y-1.5 text-sm">
            <li>Maintain your persistent shopping cart and selected products</li>
            <li>Save your wishlist items across browsing sessions</li>
            <li>Keep you signed into your authenticated customer account</li>
          </ul>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-2">
            You can clear local data anytime via your browser settings, though doing so will reset your active cart and saved preferences.
          </p>
        </div>
      )
    },
    {
      id: 'data-protection',
      title: 'Data Protection & Security',
      icon: <Shield className="text-brand-red" size={24} />,
      content: (
        <div className="space-y-3 text-gray-700 dark:text-zinc-300 font-medium">
          <p>
            We use industry-standard security measures, encrypted database connections, and row-level security protocols powered by Supabase to protect customer records from unauthorized access, disclosure, alteration, or destruction.
          </p>
        </div>
      )
    },
    {
      id: 'custom-artwork-privacy',
      title: 'Custom Artwork Privacy',
      icon: <Image className="text-brand-red" size={24} />,
      content: (
        <div className="space-y-3 text-gray-700 dark:text-zinc-300 font-medium">
          <p>
            Images and artwork uploaded for custom posters are used strictly for printing and fulfilling your specific order.
          </p>
          <p className="font-bold text-brand-black dark:text-zinc-100">
            We do not claim ownership of customer-uploaded artwork.
          </p>
        </div>
      )
    },
    {
      id: 'contact',
      title: 'Contact',
      icon: <Mail className="text-brand-red" size={24} />,
      content: (
        <div className="space-y-4 text-gray-700 dark:text-zinc-300 font-medium">
          <p>If you have any questions or concerns regarding our Privacy Policy, please contact support:</p>
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="flex-1 bg-brand-white dark:bg-zinc-800 p-4 comic-border border-brand-black dark:border-zinc-700 border-2 shadow-none">
              <h4 className="font-bold text-xs uppercase text-gray-500 dark:text-zinc-400 tracking-wider mb-2">Email</h4>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <a
                  href="mailto:posterealm5@gmail.com"
                  className="text-brand-black dark:text-zinc-100 hover:text-brand-red font-bold transition-colors"
                >
                  posterealm5@gmail.com
                </a>
                <button
                  onClick={(e) => handleCopyEmail(e)}
                  className="p-1 bg-white dark:bg-zinc-700 text-brand-black dark:text-zinc-100 hover:bg-brand-red hover:text-white transition-colors comic-border border-2 border-brand-black dark:border-zinc-600 shadow-none py-0.5 px-2 text-xs font-black uppercase tracking-wider shrink-0 max-w-max flex items-center gap-1"
                  title="Copy Email"
                >
                  <Copy size={12} />
                  <span>Copy</span>
                </button>
              </div>
            </div>
            <div className="flex-1 bg-brand-white dark:bg-zinc-800 p-4 comic-border border-brand-black dark:border-zinc-700 border-2 shadow-none">
              <h4 className="font-bold text-xs uppercase text-gray-500 dark:text-zinc-400 tracking-wider mb-2">WhatsApp</h4>
              <div className="flex flex-col gap-1 font-bold text-sm">
                <a href="https://wa.me/918949923501?text=Hi%20Posterealm,%20I%20have%20a%20question%20regarding%20your%20Privacy%20Policy." target="_blank" rel="noopener noreferrer" className="hover:text-brand-red transition-colors text-brand-black dark:text-zinc-100">
                  WhatsApp Support
                </a>
              </div>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="pt-32 pb-24 bg-brand-white dark:bg-[#0D0D0D] text-brand-black dark:text-zinc-100 min-h-screen">
      <SEO metadata={getStaticPageMetadata('Privacy Policy', 'Privacy Policy | Posterealm', 'Privacy Policy and customer data guidelines at Posterealm.')} />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Back Button */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-brand-black dark:text-zinc-200 font-black uppercase tracking-wider hover:text-brand-red transition-colors mb-8 group text-xs md:text-sm"
        >
          <ArrowLeft size={18} className="transform group-hover:-translate-x-1 transition-transform" />
          Back to Home
        </Link>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-12 border-b-4 border-brand-black dark:border-zinc-700 pb-8"
        >
          <h1 className="text-5xl md:text-7xl font-black mb-4 tracking-tight text-brand-black dark:text-zinc-100">
            PRIVACY <span className="text-brand-red">POLICY</span>
          </h1>
          <p className="text-lg text-gray-600 dark:text-zinc-400 font-medium max-w-2xl font-sans">
            Your trust is our most valuable asset. Read about what information we collect, how it's protected, and how we use it to fulfill your orders.
          </p>
        </motion.div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

          {/* Quick Navigation Panel */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="sticky top-36 bg-white dark:bg-zinc-900 comic-border border-brand-black dark:border-zinc-700 border-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(230,57,70,0.5)] p-5">
              <h3 className="font-display font-black text-lg uppercase tracking-tight text-brand-black dark:text-zinc-100 border-b-2 border-brand-black dark:border-zinc-700 pb-2 mb-4">
                SECTIONS
              </h3>
              <nav className="space-y-2 font-display text-sm font-bold uppercase tracking-wider">
                {sections.map((sec) => (
                  <a
                    key={sec.id}
                    href={`#${sec.id}`}
                    className="block text-gray-500 dark:text-zinc-400 hover:text-brand-red dark:hover:text-brand-red transition-colors py-1 border-b border-gray-100 dark:border-zinc-800 hover:border-brand-red"
                  >
                    {sec.title}
                  </a>
                ))}
              </nav>
            </div>
          </div>

          {/* Detailed Policy Cards */}
          <div className="lg:col-span-3 space-y-8">
            {sections.map((sec, idx) => (
              <motion.section
                key={sec.id}
                id={sec.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-100px' }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
                className="scroll-mt-36 bg-white dark:bg-zinc-900 comic-border border-brand-black dark:border-zinc-700 border-3 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(230,57,70,0.5)] p-6 md:p-8"
              >
                <div className="flex items-center gap-3 border-b-2 border-brand-black dark:border-zinc-700 pb-3 mb-6">
                  {sec.icon}
                  <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-brand-black dark:text-zinc-100">
                    {sec.title}
                  </h2>
                </div>
                <div className="font-sans">
                  {sec.content}
                </div>
              </motion.section>
            ))}
          </div>

        </div>

      </div>
    </div>
  );
}
