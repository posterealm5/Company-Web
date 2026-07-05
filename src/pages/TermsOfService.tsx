import React from 'react';
import { Link } from 'react-router-dom';
import { SEO } from '../components/SEO';
import { getStaticPageMetadata } from '../services/metadata';
import { motion } from 'motion/react';
import { ArrowLeft, BookOpen, AlertCircle, Image, Scale, ShoppingBag, Truck, Tag, ShieldAlert, Edit3, MessageCircle, Copy } from 'lucide-react';
import { useCart } from '../context/CartContext';

export default function TermsOfService() {
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
      title: 'Acceptance of Terms',
      icon: <BookOpen className="text-brand-red animate-pulse" size={24} />,
      content: (
        <div className="space-y-3 font-sans font-medium text-gray-700">
          <p>By accessing or using Posterealm, you agree to comply with these Terms of Service.</p>
          <p className="text-sm font-bold text-brand-red uppercase tracking-wider">
            If you do not agree with these terms, please do not use the website.
          </p>
        </div>
      )
    },
    {
      title: 'Fan Art Disclaimer',
      icon: <AlertCircle className="text-brand-red" size={24} />,
      content: (
        <div className="space-y-3 font-sans font-medium text-gray-700">
          <p>Unless explicitly stated otherwise, the posters displayed on Posterealm are fan-created artwork and are not official merchandise.</p>
          <p>All trademarks, characters, logos, and copyrights remain the property of their respective owners.</p>
          <p className="text-xs italic text-gray-500">
            Posterealm does not claim ownership of third-party intellectual property represented within fan art designs.
          </p>
        </div>
      )
    },
    {
      title: 'Custom Uploads',
      icon: <Image className="text-brand-red" size={24} />,
      content: (
        <div className="space-y-4 font-sans font-medium text-gray-700">
          <div>
            <p className="font-bold text-sm uppercase tracking-wider text-brand-black mb-1">When uploading your own artwork, you confirm that:</p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>You own the content, or</li>
              <li>You have the necessary rights and permissions to use it.</li>
            </ul>
          </div>
          <div>
            <p className="font-bold text-sm uppercase tracking-wider text-brand-black mb-1">You may not upload content that:</p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>Violates copyrights or trademarks</li>
              <li>Contains illegal material</li>
              <li>Contains hateful, abusive, or offensive content.</li>
            </ul>
          </div>
          <p className="text-xs font-bold text-brand-red uppercase tracking-wider">
            Posterealm reserves the right to reject or cancel orders containing prohibited content.
          </p>
        </div>
      )
    },
    {
      title: 'Intellectual Property',
      icon: <Scale className="text-brand-red" size={24} />,
      content: (
        <p className="font-sans font-medium text-gray-700 leading-relaxed">
          Posterealm designs, branding, website content, graphics, logos, and original artwork remain the property of Posterealm and may not be copied, reproduced, or redistributed without permission.
        </p>
      )
    },
    {
      title: 'Orders and Pricing',
      icon: <ShoppingBag className="text-brand-red" size={24} />,
      content: (
        <div className="space-y-3 font-sans font-medium text-gray-700">
          <p>We strive to maintain accurate pricing and product information.</p>
          <div>
            <p className="font-bold text-xs uppercase tracking-wider text-gray-500 mb-1">Posterealm reserves the right to:</p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>Correct pricing errors</li>
              <li>Refuse or cancel orders when necessary</li>
              <li>Modify product offerings without prior notice</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      title: 'Shipping and Fulfillment',
      icon: <Truck className="text-brand-red" size={24} />,
      content: (
        <div className="space-y-2 font-sans font-medium text-gray-700">
          <p>Production generally begins shortly after order placement.</p>
          <p className="text-sm italic border-l-4 border-brand-red pl-4 bg-brand-white/50 p-2">
            Delivery timelines may vary based on location, courier performance, weather conditions, and other factors beyond our control.
          </p>
        </div>
      )
    },
    {
      title: 'Coupon Usage',
      icon: <Tag className="text-brand-red" size={24} />,
      content: (
        <div className="space-y-3 font-sans font-medium text-gray-700">
          <div>
            <p className="font-bold text-xs uppercase tracking-wider text-gray-500 mb-1">Coupons may be subject to:</p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>Minimum order requirements</li>
              <li>Expiration dates</li>
              <li>Usage limitations</li>
            </ul>
          </div>
          <p className="text-xs font-bold text-brand-red uppercase tracking-wider">
            Only one coupon may be used per order unless explicitly stated otherwise.
          </p>
        </div>
      )
    },
    {
      title: 'Limitation of Liability',
      icon: <ShieldAlert className="text-brand-red" size={24} />,
      content: (
        <p className="font-sans font-medium text-gray-700 leading-relaxed">
          Posterealm shall not be liable for indirect, incidental, or consequential damages resulting from the use of our website, products, or services.
        </p>
      )
    },
    {
      title: 'Changes to Terms',
      icon: <Edit3 className="text-brand-red" size={24} />,
      content: (
        <p className="font-sans font-medium text-gray-700 leading-relaxed">
          Posterealm may update these Terms of Service at any time. Continued use of the website constitutes acceptance of any updated terms.
        </p>
      )
    },
    {
      title: 'Contact',
      icon: <MessageCircle className="text-brand-red" size={24} />,
      content: (
        <div className="space-y-4 font-sans font-medium text-gray-700">
          <p>For questions regarding these Terms of Service:</p>
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="flex-1 bg-brand-white p-4 comic-border border-brand-black border-2 shadow-none">
              <h4 className="font-bold text-xs uppercase text-gray-500 tracking-wider mb-2">Email</h4>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <a 
                  href="mailto:posterealm5@gmail.com" 
                  className="text-brand-black hover:text-brand-red font-bold transition-colors"
                >
                  posterealm5@gmail.com
                </a>
                <button 
                  onClick={(e) => handleCopyEmail(e)}
                  className="p-1 bg-white hover:bg-brand-red hover:text-white transition-colors comic-border border-2 border-brand-black shadow-none py-0.5 px-2 text-xs font-black uppercase tracking-wider shrink-0 max-w-max flex items-center gap-1"
                  title="Copy Email"
                >
                  <Copy size={12} />
                  <span>Copy</span>
                </button>
              </div>
            </div>
            <div className="flex-1 bg-brand-white p-4 comic-border border-brand-black border-2 shadow-none">
              <h4 className="font-bold text-xs uppercase text-gray-500 tracking-wider mb-2">WhatsApp</h4>
              <div className="flex flex-col gap-1 font-bold text-sm">
                <a href="https://wa.me/918949923501?text=Hi%20Posterealm,%20I%20have%20a%20question%20regarding%20your%20Terms%20of%20Service." target="_blank" rel="noopener noreferrer" className="hover:text-brand-red transition-colors">
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
    <div className="pt-32 pb-24 bg-brand-white min-h-screen">
      <SEO metadata={getStaticPageMetadata('Terms of Service', 'Terms of Service | Posterealm', 'Terms of Service and official policies at Posterealm.')} />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Back Button */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-brand-black font-black uppercase tracking-wider hover:text-brand-red transition-colors mb-8 group text-xs md:text-sm"
        >
          <ArrowLeft size={18} className="transform group-hover:-translate-x-1 transition-transform" />
          Back to Home
        </Link>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-12 border-b-4 border-brand-black pb-8"
        >
          <h1 className="text-5xl md:text-7xl font-black mb-4 tracking-tight">
            TERMS OF <span className="text-brand-red">SERVICE</span>
          </h1>
          <p className="text-lg text-gray-600 font-medium max-w-2xl font-sans">
            Please read these terms carefully before accessing or using our services. By using Posterealm, you agree to these conditions.
          </p>
        </motion.div>

        {/* Grid layout for sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {sections.map((sec, idx) => (
            <motion.section
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, delay: idx * 0.05 }}
              className={`bg-white comic-border border-brand-black border-3 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-6 md:p-8 flex flex-col justify-between ${sec.title === 'Contact' ? 'md:col-span-2' : ''
                }`}
            >
              <div>
                <div className="flex items-center gap-3 border-b-2 border-brand-black pb-3 mb-4">
                  {sec.icon}
                  <h2 className="text-2xl font-black uppercase tracking-tight text-brand-black">
                    {sec.title}
                  </h2>
                </div>
                <div>
                  {sec.content}
                </div>
              </div>
            </motion.section>
          ))}
        </div>

      </div>
    </div>
  );
}
