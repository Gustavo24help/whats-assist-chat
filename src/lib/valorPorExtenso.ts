const unidades = [
  '', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
  'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'
];

const dezenas = [
  '', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'
];

const centenas = [
  '', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 
  'seiscentos', 'setecentos', 'oitocentos', 'novecentos'
];

function converterCentenas(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cem';
  
  const c = Math.floor(n / 100);
  const resto = n % 100;
  
  let resultado = centenas[c];
  
  if (resto > 0) {
    if (resultado) resultado += ' e ';
    
    if (resto < 20) {
      resultado += unidades[resto];
    } else {
      const d = Math.floor(resto / 10);
      const u = resto % 10;
      resultado += dezenas[d];
      if (u > 0) {
        resultado += ' e ' + unidades[u];
      }
    }
  }
  
  return resultado;
}

function converterMilhares(n: number): string {
  if (n === 0) return 'zero';
  if (n === 1000) return 'mil';
  
  const milhares = Math.floor(n / 1000);
  const resto = n % 1000;
  
  let resultado = '';
  
  if (milhares > 0) {
    if (milhares === 1) {
      resultado = 'mil';
    } else {
      resultado = converterCentenas(milhares) + ' mil';
    }
  }
  
  if (resto > 0) {
    if (resultado) {
      // Se resto < 100 ou termina em 00, usa "e"
      if (resto < 100 || resto % 100 === 0) {
        resultado += ' e ';
      } else {
        resultado += ' ';
      }
    }
    resultado += converterCentenas(resto);
  }
  
  return resultado;
}

export function valorPorExtenso(valor: number): string {
  if (valor === 0) return 'zero reais';
  
  const valorInteiro = Math.floor(valor);
  const centavos = Math.round((valor - valorInteiro) * 100);
  
  let resultado = '';
  
  if (valorInteiro > 0) {
    resultado = converterMilhares(valorInteiro);
    resultado += valorInteiro === 1 ? ' real' : ' reais';
  }
  
  if (centavos > 0) {
    if (resultado) resultado += ' e ';
    resultado += converterCentenas(centavos);
    resultado += centavos === 1 ? ' centavo' : ' centavos';
  }
  
  // Capitalizar primeira letra
  return resultado.charAt(0).toUpperCase() + resultado.slice(1);
}
